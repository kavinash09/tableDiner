import { PrismaClient } from '@prisma/client';
import { RestaurantAnalyticsRepository } from '../../../core/ports/RestaurantAnalyticsRepository';
import {
  DailyFinancialMetrics,
  DailyOrderMetrics,
  DailyUtilizationMetrics,
  DailySlaMetrics,
  EodSessionRecord
} from '@tablediner/shared-types';

export class PrismaRestaurantAnalyticsRepository implements RestaurantAnalyticsRepository {
  constructor(private prisma: PrismaClient) {}

  public async getFinancialMetrics(restaurantId: string, businessDate: string): Promise<DailyFinancialMetrics> {
    const aggregate = await this.prisma.session.aggregate({
      where: {
        restaurantId,
        businessDate,
        status: { not: 'OPEN' } // Include CLOSED, REOPENED, FINALIZED
      },
      _sum: {
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        tipAmount: true,
        totalAmount: true,
        refundedAmount: true
      },
      _count: {
        id: true
      }
    });

    const closedSessionsCount = aggregate._count.id || 0;
    const netRevenue = (aggregate._sum.totalAmount || 0) - (aggregate._sum.taxAmount || 0) - (aggregate._sum.tipAmount || 0);

    return {
      grossRevenue: aggregate._sum.totalAmount || 0,
      netRevenue: netRevenue,
      totalDiscounts: aggregate._sum.discountAmount || 0,
      totalTips: aggregate._sum.tipAmount || 0,
      refundedRevenue: aggregate._sum.refundedAmount || 0,
      avgTicketSize: closedSessionsCount > 0 ? netRevenue / closedSessionsCount : 0
    };
  }

  public async getOrderMetrics(restaurantId: string, businessDate: string): Promise<DailyOrderMetrics> {
    const statuses = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        session: { restaurantId },
        businessDate
      },
      _count: {
        id: true
      }
    });

    let total = 0;
    let completed = 0;
    let cancelled = 0;

    for (const group of statuses) {
      total += group._count.id;
      if (group.status === 'SERVED') completed += group._count.id;
      if (group.status === 'CANCELLED' || group.status === 'REJECTED') cancelled += group._count.id;
    }

    return {
      totalOrders: total,
      completedOrders: completed,
      cancelledOrders: cancelled,
      cancellationRate: total > 0 ? cancelled / total : 0
    };
  }

  public async getUtilizationMetrics(restaurantId: string, businessDate: string, operatingMinutes: number): Promise<DailyUtilizationMetrics> {
    // 1. Get Guest Counts & Session Count
    const sessionAggr = await this.prisma.session.aggregate({
      where: { restaurantId, businessDate, status: { not: 'OPEN' } },
      _sum: { guestCount: true, totalAmount: true },
      _count: { id: true }
    });

    const covers = sessionAggr._sum.guestCount || 0;
    const sessionCount = sessionAggr._count.id || 0;
    const netRevenue = (sessionAggr._sum.totalAmount || 0); // Simplified net for covers calculation

    // 2. Calculate Table Turn Time & Occupancy directly in the database (PostgreSQL interval math)
    const durationResult = await this.prisma.$queryRaw<Array<{ totalOccupiedMinutes: number | null }>>`
      SELECT 
        SUM(CASE WHEN "closedAt" > "createdAt" THEN EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 60.0 ELSE 0.0 END) as "totalOccupiedMinutes"
      FROM "Session"
      WHERE "restaurantId" = ${restaurantId}
        AND "businessDate" = ${businessDate}
        AND "status" != 'OPEN'
        AND "closedAt" IS NOT NULL
    `;

    const totalOccupiedMinutes = durationResult[0]?.totalOccupiedMinutes != null
      ? Math.max(0, Number(durationResult[0].totalOccupiedMinutes))
      : 0;

    // Get table count
    const tableCount = await this.prisma.table.count({ where: { restaurantId, isActive: true } });
    const availableMinutes = tableCount * operatingMinutes;

    return {
      coversServed: covers,
      avgPartySize: sessionCount > 0 ? covers / sessionCount : 0,
      revenuePerCover: covers > 0 ? netRevenue / covers : 0,
      occupancyPercent: availableMinutes > 0 ? totalOccupiedMinutes / availableMinutes : 0,
      avgTableTurnTimeMinutes: sessionCount > 0 ? totalOccupiedMinutes / sessionCount : 0
    };
  }

  public async getSlaMetrics(restaurantId: string, businessDate: string): Promise<DailySlaMetrics> {
    // Calculate kitchen SLA metrics directly in PostgreSQL
    const slaResult = await this.prisma.$queryRaw<Array<{
      count: bigint | number;
      avgKitchenPrepTimeMinutes: number | null;
      avgServiceTimeMinutes: number | null;
      avgFulfillmentTimeMinutes: number | null;
    }>>`
      SELECT 
        COUNT(o.id) as count,
        AVG(EXTRACT(EPOCH FROM (o."readyAt" - o."acceptedAt")) / 60.0) as "avgKitchenPrepTimeMinutes",
        AVG(EXTRACT(EPOCH FROM (o."servedAt" - o."readyAt")) / 60.0) as "avgServiceTimeMinutes",
        AVG(EXTRACT(EPOCH FROM (o."servedAt" - o."createdAt")) / 60.0) as "avgFulfillmentTimeMinutes"
      FROM "Order" o
      JOIN "Session" s ON o."sessionId" = s.id
      WHERE s."restaurantId" = ${restaurantId}
        AND o."businessDate" = ${businessDate}
        AND o."status" = 'SERVED'
        AND o."acceptedAt" IS NOT NULL
        AND o."readyAt" IS NOT NULL
        AND o."servedAt" IS NOT NULL
    `;

    const row = slaResult[0];
    const orderCount = row ? Number(row.count) : 0;

    return {
      avgKitchenPrepTimeMinutes: orderCount > 0 && row?.avgKitchenPrepTimeMinutes != null ? Number(row.avgKitchenPrepTimeMinutes) : 0,
      avgServiceTimeMinutes: orderCount > 0 && row?.avgServiceTimeMinutes != null ? Number(row.avgServiceTimeMinutes) : 0,
      avgFulfillmentTimeMinutes: orderCount > 0 && row?.avgFulfillmentTimeMinutes != null ? Number(row.avgFulfillmentTimeMinutes) : 0
    };
  }

  public async getEodSessions(restaurantId: string, businessDate: string): Promise<EodSessionRecord[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        restaurantId,
        businessDate,
        status: { not: 'OPEN' } // Include CLOSED, REOPENED, FINALIZED
      },
      include: {
        table: true,
        payments: {
          where: { status: 'COMPLETED' },
          select: { method: true }
        }
      },
      orderBy: { closedAt: 'asc' }
    });

    return sessions.map(s => {
      // Net = Total - Tax - Tip
      const netAmount = (s.totalAmount || 0) - (s.taxAmount || 0) - (s.tipAmount || 0);
      
      const paymentMethods = Array.from(new Set(s.payments.map(p => p.method).filter(Boolean))) as string[];

      return {
        sessionId: s.id,
        tableName: s.table.name,
        guestCount: s.guestCount,
        grossAmount: s.totalAmount || 0,
        discountAmount: s.discountAmount || 0,
        taxAmount: s.taxAmount || 0,
        tipAmount: s.tipAmount || 0,
        netAmount: netAmount,
        paymentMethods: paymentMethods,
        closedAt: s.closedAt ? s.closedAt.toISOString() : s.createdAt.toISOString(),
        status: s.status
      };
    });
  }
}

