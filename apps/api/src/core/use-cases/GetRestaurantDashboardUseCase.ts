import { RestaurantDashboardResponse } from '@tablediner/shared-types';
import { RestaurantAnalyticsRepository } from '../ports/RestaurantAnalyticsRepository';

export class GetRestaurantDashboardUseCase {
  constructor(
    private analyticsRepo: RestaurantAnalyticsRepository
  ) {}

  public async execute(restaurantId: string, businessDate: string): Promise<RestaurantDashboardResponse> {
    
    // For MVP, we'll assume a standard 12-hour operating day (720 minutes) for occupancy calcs
    // In the future, this should be fetched from Restaurant Configuration
    const ASSUMED_OPERATING_MINUTES = 720;

    const [financials, orders, utilization, slas] = await Promise.all([
      this.analyticsRepo.getFinancialMetrics(restaurantId, businessDate),
      this.analyticsRepo.getOrderMetrics(restaurantId, businessDate),
      this.analyticsRepo.getUtilizationMetrics(restaurantId, businessDate, ASSUMED_OPERATING_MINUTES),
      this.analyticsRepo.getSlaMetrics(restaurantId, businessDate)
    ]);

    return {
      businessDate,
      financials,
      orders,
      utilization,
      slas
    };
  }
}

