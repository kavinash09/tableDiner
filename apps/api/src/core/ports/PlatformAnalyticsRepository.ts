import {
  PlatformFinancialMetrics,
  PlatformGmvMetrics,
  TenantFunnelMetrics
} from '@tablediner/shared-types';

export interface PlatformAnalyticsRepository {
  getFinancialMetrics(): Promise<PlatformFinancialMetrics>;
  getGmvMetrics(reportDate: string): Promise<PlatformGmvMetrics>;
  getTenantFunnel(): Promise<TenantFunnelMetrics>;
}

