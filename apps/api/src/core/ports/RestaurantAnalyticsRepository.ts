import {
  DailyFinancialMetrics,
  DailyOrderMetrics,
  DailyUtilizationMetrics,
  DailySlaMetrics,
  EodSessionRecord
} from '@tablediner/shared-types';

export interface RestaurantAnalyticsRepository {
  getFinancialMetrics(restaurantId: string, businessDate: string): Promise<DailyFinancialMetrics>;
  getOrderMetrics(restaurantId: string, businessDate: string): Promise<DailyOrderMetrics>;
  getUtilizationMetrics(restaurantId: string, businessDate: string, operatingMinutes: number): Promise<DailyUtilizationMetrics>;
  getSlaMetrics(restaurantId: string, businessDate: string): Promise<DailySlaMetrics>;
  getEodSessions(restaurantId: string, businessDate: string): Promise<EodSessionRecord[]>;
}

