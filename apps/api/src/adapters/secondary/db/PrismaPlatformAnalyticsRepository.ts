import { PrismaClient } from '@prisma/client';
import { PlatformAnalyticsRepository } from '../../../core/ports/PlatformAnalyticsRepository';
import {
  PlatformFinancialMetrics,
  PlatformGmvMetrics,
  TenantFunnelMetrics
} from '@tablediner/shared-types';

export class PrismaPlatformAnalyticsRepository implements PlatformAnalyticsRepository {
  constructor(private prisma: PrismaClient) {}

  public async getFinancialMetrics(): Promise<PlatformFinancialMetrics> {
    const aggregate = await this.prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { mrr: true }
    });
    
    // Simplistic churn calculation for MVP
    const activeCount = await this.prisma.subscription.count({ where: { status: 'ACTIVE' } });
    const canceledCount = await this.prisma.subscription.count({ where: { status: 'CANCELED' } });
    
    const churnRate = (activeCount + canceledCount) > 0 ? canceledCount / (activeCount + canceledCount) : 0;

    return {
      mrr: aggregate._sum.mrr || 0,
      arr: (aggregate._sum.mrr || 0) * 12,
      newMrr: 0, // Requires complex time-series tracking post-MVP
      churnedMrr: 0, 
      churnRate: churnRate
    };
  }

  public async getGmvMetrics(reportDate: string): Promise<PlatformGmvMetrics> {
    // This is where the denormalized tenantId shines! We don't need a JOIN.
    const sessionAggr = await this.prisma.session.aggregate({
      where: {
        businessDate: reportDate,
        status: { not: 'OPEN' }
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const orderAggr = await this.prisma.order.aggregate({
      where: {
        businessDate: reportDate,
        status: { notIn: ['CANCELLED', 'REJECTED'] }
      },
      _count: { id: true }
    });

    const totalGmv = sessionAggr._sum.totalAmount || 0;
    const sessionCount = sessionAggr._count.id || 0;

    return {
      totalGmv,
      ordersProcessed: orderAggr._count.id || 0,
      sessionsProcessed: sessionCount,
      avgOrderValue: sessionCount > 0 ? totalGmv / sessionCount : 0
    };
  }

  public async getTenantFunnel(): Promise<TenantFunnelMetrics> {
    const groupByStatus = await this.prisma.tenant.groupBy({
      by: ['onboardingStatus'],
      _count: { id: true }
    });

    let leadCount = 0, trialCount = 0, activeCount = 0, suspendedCount = 0, decommissionedCount = 0;

    for (const group of groupByStatus) {
      if (group.onboardingStatus === 'LEAD') leadCount = group._count.id;
      if (group.onboardingStatus === 'ONBOARDING') trialCount = group._count.id;
      if (group.onboardingStatus === 'ACTIVE') activeCount = group._count.id;
      if (group.onboardingStatus === 'SUSPENDED') suspendedCount = group._count.id;
      if (group.onboardingStatus === 'DECOMMISSIONED') decommissionedCount = group._count.id;
    }

    return {
      leadCount,
      trialCount,
      activeCount,
      suspendedCount,
      decommissionedCount
    };
  }
}

