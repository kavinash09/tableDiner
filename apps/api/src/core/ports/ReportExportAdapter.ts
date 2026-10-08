import { RestaurantEodReportResponse } from '@tablediner/shared-types';

export interface ReportExportAdapter {
  generateEodCsv(report: RestaurantEodReportResponse): string;
}

