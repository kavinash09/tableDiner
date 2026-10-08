import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@tablediner/db';
import { PrismaRestaurantAnalyticsRepository } from '../adapters/secondary/db/PrismaRestaurantAnalyticsRepository';

describe('Analytics Database Aggregation & Performance Integration Tests (Issue 3)', () => {
  let analyticsRepo: PrismaRestaurantAnalyticsRepository;
  const testBusinessDate = '2026-10-09';
  let testRestaurantId: string;
  let testTenantId: string;

  beforeEach(async () => {
    analyticsRepo = new PrismaRestaurantAnalyticsRepository(prisma);

    // Setup isolated tenant and restaurant for testing
    const tenant = await prisma.tenant.create({
      data: {
        name: `Analytics Test Tenant ${Date.now()}`
      }
    });
    testTenantId = tenant.id;

    const restaurant = await prisma.restaurant.create({
      data: {
        name: `Analytics Test Restaurant ${Date.now()}`,
        tenantId: testTenantId,
        tables: {
          create: [
            { name: 'Table A1', qrCode: `T-A1-${Date.now()}` },
            { name: 'Table A2', qrCode: `T-A2-${Date.now()}` }
          ]
        }
      },
      include: { tables: true }
    });
    testRestaurantId = restaurant.id;
  });

  it('calculates utilization metrics directly via DB aggregation without in-memory looping', async () => {
    const tables = await prisma.table.findMany({ where: { restaurantId: testRestaurantId } });

    const now = Date.now();
    // Session 1: 30 minutes duration (Table 1), 2 guests, total 100
    const start1 = new Date(now - 60 * 60 * 1000);
    const end1 = new Date(now - 30 * 60 * 1000); // 30 min duration

    // Session 2: 60 minutes duration (Table 2), 4 guests, total 200
    const start2 = new Date(now - 90 * 60 * 1000);
    const end2 = new Date(now - 30 * 60 * 1000); // 60 min duration

    await prisma.session.create({
      data: {
        tenantId: testTenantId,
        restaurantId: testRestaurantId,
        tableId: tables[0].id,
        status: 'CLOSED',
        businessDate: testBusinessDate,
        guestCount: 2,
        totalAmount: 100,
        createdAt: start1,
        closedAt: end1
      }
    });

    await prisma.session.create({
      data: {
        tenantId: testTenantId,
        restaurantId: testRestaurantId,
        tableId: tables[1].id,
        status: 'CLOSED',
        businessDate: testBusinessDate,
        guestCount: 4,
        totalAmount: 200,
        createdAt: start2,
        closedAt: end2
      }
    });

    // OPEN session (should be excluded from utilization and turn time)
    await prisma.session.create({
      data: {
        tenantId: testTenantId,
        restaurantId: testRestaurantId,
        tableId: tables[0].id,
        status: 'OPEN',
        businessDate: testBusinessDate,
        guestCount: 3,
        totalAmount: 50
      }
    });

    // 2 tables * 720 operating minutes = 1440 available minutes
    // Total occupied minutes = 30 + 60 = 90 minutes
    const operatingMinutes = 720;
    const metrics = await analyticsRepo.getUtilizationMetrics(testRestaurantId, testBusinessDate, operatingMinutes);

    expect(metrics.coversServed).toBe(6); // 2 + 4
    expect(metrics.avgPartySize).toBe(3); // 6 covers / 2 closed sessions
    expect(metrics.revenuePerCover).toBe(50); // 300 / 6
    expect(metrics.avgTableTurnTimeMinutes).toBeCloseTo(45, 1); // (30 + 60) / 2 sessions = 45 mins
    expect(metrics.occupancyPercent).toBeCloseTo(90 / (2 * 720), 4);
  });

  it('handles zero sessions gracefully without division by zero', async () => {
    const metrics = await analyticsRepo.getUtilizationMetrics(testRestaurantId, '2099-01-01', 720);
    expect(metrics.coversServed).toBe(0);
    expect(metrics.avgPartySize).toBe(0);
    expect(metrics.revenuePerCover).toBe(0);
    expect(metrics.avgTableTurnTimeMinutes).toBe(0);
    expect(metrics.occupancyPercent).toBe(0);
  });

  it('calculates SLA metrics directly via DB aggregation without in-memory looping', async () => {
    const table = await prisma.table.findFirstOrThrow({ where: { restaurantId: testRestaurantId } });

    const baseTime = Date.now();

    const session = await prisma.session.create({
      data: {
        tenantId: testTenantId,
        restaurantId: testRestaurantId,
        tableId: table.id,
        status: 'CLOSED',
        businessDate: testBusinessDate,
        guestCount: 2,
        totalAmount: 150,
        closedAt: new Date(baseTime + 20 * 60000)
      }
    });

    // Order 1:
    // createdAt: T+0
    // acceptedAt: T+2 min
    // readyAt: T+10 min (prep: 8 min)
    // servedAt: T+15 min (service: 5 min, total fulfillment: 15 min)
    const order1Created = new Date(baseTime);
    const order1Accepted = new Date(baseTime + 2 * 60000);
    const order1Ready = new Date(baseTime + 10 * 60000);
    const order1Served = new Date(baseTime + 15 * 60000);

    await prisma.order.create({
      data: {
        tenantId: testTenantId,
        sessionId: session.id,
        status: 'SERVED',
        businessDate: testBusinessDate,
        createdAt: order1Created,
        acceptedAt: order1Accepted,
        readyAt: order1Ready,
        servedAt: order1Served
      }
    });

    // Order 2:
    // createdAt: T+0
    // acceptedAt: T+1 min
    // readyAt: T+7 min (prep: 6 min)
    // servedAt: T+11 min (service: 4 min, total fulfillment: 11 min)
    const order2Created = new Date(baseTime);
    const order2Accepted = new Date(baseTime + 1 * 60000);
    const order2Ready = new Date(baseTime + 7 * 60000);
    const order2Served = new Date(baseTime + 11 * 60000);

    await prisma.order.create({
      data: {
        tenantId: testTenantId,
        sessionId: session.id,
        status: 'SERVED',
        businessDate: testBusinessDate,
        createdAt: order2Created,
        acceptedAt: order2Accepted,
        readyAt: order2Ready,
        servedAt: order2Served
      }
    });

    // Order 3: CANCELLED (should be excluded from SLA calculations)
    await prisma.order.create({
      data: {
        tenantId: testTenantId,
        sessionId: session.id,
        status: 'CANCELLED',
        businessDate: testBusinessDate,
        createdAt: new Date(baseTime),
        acceptedAt: new Date(baseTime + 1 * 60000),
        cancelledAt: new Date(baseTime + 3 * 60000)
      }
    });

    const sla = await analyticsRepo.getSlaMetrics(testRestaurantId, testBusinessDate);

    // Expected:
    // Prep: (8 + 6) / 2 = 7 min
    // Service: (5 + 4) / 2 = 4.5 min
    // Fulfillment: (15 + 11) / 2 = 13 min
    expect(sla.avgKitchenPrepTimeMinutes).toBeCloseTo(7.0, 1);
    expect(sla.avgServiceTimeMinutes).toBeCloseTo(4.5, 1);
    expect(sla.avgFulfillmentTimeMinutes).toBeCloseTo(13.0, 1);
  });

  it('handles zero orders SLA gracefully without errors', async () => {
    const sla = await analyticsRepo.getSlaMetrics(testRestaurantId, '2099-01-01');
    expect(sla.avgKitchenPrepTimeMinutes).toBe(0);
    expect(sla.avgServiceTimeMinutes).toBe(0);
    expect(sla.avgFulfillmentTimeMinutes).toBe(0);
  });
});
