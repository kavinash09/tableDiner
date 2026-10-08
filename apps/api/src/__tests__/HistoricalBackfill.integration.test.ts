import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@tablediner/db';
import { backfillHistoricalSessions } from '../../../../packages/db/scripts/backfill-sessions';

describe('Historical Session Backfill Integration & Regression Tests', () => {
  let testTenantId: string;
  let testRestaurantId: string;
  let testTableId: string;
  let testMenuItemId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: { name: `Backfill Test Tenant ${Date.now()}` }
    });
    testTenantId = tenant.id;

    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Backfill Kitchen',
        tenantId: testTenantId,
        businessDayCutoffHour: 4
      }
    });
    testRestaurantId = restaurant.id;

    const table = await prisma.table.create({
      data: {
        name: 'Backfill Table',
        qrCode: `backfill-qr-${Date.now()}`,
        restaurantId: testRestaurantId
      }
    });
    testTableId = table.id;

    const category = await prisma.menuCategory.create({
      data: { name: 'Dessert', restaurantId: testRestaurantId }
    });

    const item = await prisma.menuItem.create({
      data: {
        name: 'Chocolate Lava Cake',
        price: 180.0,
        restaurantId: testRestaurantId,
        categoryId: category.id
      }
    });
    testMenuItemId = item.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('P0 Regression: should safely repair broken historical sessions missing closedAt and totals', async () => {
    // 1. Manually simulate an older broken session (status = CLOSED, closedAt = null, totalAmount = 0)
    const brokenSession = await prisma.session.create({
      data: {
        tenantId: testTenantId,
        restaurantId: testRestaurantId,
        tableId: testTableId,
        status: 'CLOSED',
        closedAt: null,
        subtotal: 0,
        totalAmount: 0,
        businessDate: '2026-10-08'
      }
    });

    // 2. Attach an order with 2 Lava Cakes (2 * 180 = 360)
    const order = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        sessionId: brokenSession.id,
        status: 'SERVED',
        businessDate: '2026-10-08',
        items: {
          create: [
            {
              tenantId: testTenantId,
              menuItemId: testMenuItemId,
              quantity: 2,
              unitPrice: 180.0,
              lineTotal: 360.0
            }
          ]
        }
      }
    });

    // 3. Attach a payment record created 10 minutes ago
    const pastTime = new Date(Date.now() - 600000);
    await prisma.payment.create({
      data: {
        tenantId: testTenantId,
        sessionId: brokenSession.id,
        status: 'COMPLETED',
        amount: 360.0,
        method: 'CASH',
        createdAt: pastTime
      }
    });

    // 4. Run the idempotent backfill procedure
    const result = await backfillHistoricalSessions();
    expect(result.scpaired !== undefined || result.repaired > 0).toBe(true);

    // 5. Assert the session was repaired accurately
    const repairedSession = await prisma.session.findUnique({
      where: { id: brokenSession.id }
    });

    expect(repairedSession).not.toBeNull();
    expect(repairedSession!.closedAt).not.toBeNull();
    // Verify closedAt matches payment createdAt timestamp
    expect(repairedSession!.closedAt!.toISOString()).toBe(pastTime.toISOString());
    // Verify subtotal and totalAmount were reconstructed
    expect(repairedSession!.subtotal).toBe(360.0);
    expect(repairedSession!.totalAmount).toBe(360.0);

    // 6. Idempotency test: Running backfill a second time should repair 0 additional records
    const secondResult = await backfillHistoricalSessions();
    expect(secondResult.repaired).toBe(0);
  });
});

