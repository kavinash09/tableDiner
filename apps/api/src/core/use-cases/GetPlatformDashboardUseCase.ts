import { PlatformDashboardResponse } from '@tablediner/shared-types';
import { PlatformAnalyticsRepository } from '../ports/PlatformAnalyticsRepository';

export class GetPlatformDashboardUseCase {
  constructor(
    private analyticsRepo: PlatformAnalyticsRepository
  ) {}

  public async execute(reportDate: string): Promise<PlatformDashboardResponse> {
    const [financials, gmv, funnel] = await Promise.all([
      this.analyticsRepo.getFinancialMetrics(),
      this.analyticsRepo.getGmvMetrics(reportDate),
      this.analyticsRepo.getTenantFunnel()
    ]);

    return {
      reportDate,
      financials,
      gmv,
      funnel
    };
  }
}

