import { RestaurantEodReportResponse } from '@tablediner/shared-types';
import { RestaurantAnalyticsRepository } from '../ports/RestaurantAnalyticsRepository';

export class GetEODAuditReportUseCase {
  constructor(private analyticsRepo: RestaurantAnalyticsRepository) {}

  public async execute(restaurantId: string, businessDate: string): Promise<RestaurantEodReportResponse> {
    const [financialSummary, sessions] = await Promise.all([
      this.analyticsRepo.getFinancialMetrics(restaurantId, businessDate),
      this.analyticsRepo.getEodSessions(restaurantId, businessDate)
    ]);

    return {
      businessDate,
      financialSummary,
      sessions
    };
  }
}

