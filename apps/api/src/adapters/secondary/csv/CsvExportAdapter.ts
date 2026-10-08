import { ReportExportAdapter } from '../../../core/ports/ReportExportAdapter';
import { RestaurantEodReportResponse } from '@tablediner/shared-types';

export class CsvExportAdapter implements ReportExportAdapter {
  public generateEodCsv(report: RestaurantEodReportResponse): string {
    const lines: string[] = [];

    // Header for Report Info
    lines.push(`"Business Date","${report.businessDate}"`);
    lines.push('');

    // Header for Financial Summary
    lines.push('"Financial Summary"');
    lines.push(`"Gross Revenue","${report.financialSummary.grossRevenue}"`);
    lines.push(`"Net Revenue","${report.financialSummary.netRevenue}"`);
    lines.push(`"Total Discounts","${report.financialSummary.totalDiscounts}"`);
    lines.push(`"Total Tips","${report.financialSummary.totalTips}"`);
    lines.push(`"Refunded Revenue","${report.financialSummary.refundedRevenue}"`);
    lines.push(`"Avg Ticket Size","${report.financialSummary.avgTicketSize}"`);
    lines.push('');

    // Header for Sessions
    lines.push('"Sessions"');
    const sessionHeaders = [
      'Session ID', 'Table Name', 'Guest Count', 'Gross Amount', 
      'Discount Amount', 'Tax Amount', 'Tip Amount', 'Net Amount', 
      'Payment Methods', 'Closed At', 'Status'
    ];
    lines.push(sessionHeaders.map(h => `"${h}"`).join(','));

    // Session Data
    for (const session of report.sessions) {
      const row = [
        session.sessionId,
        session.tableName,
        session.guestCount.toString(),
        session.grossAmount.toString(),
        session.discountAmount.toString(),
        session.taxAmount.toString(),
        session.tipAmount.toString(),
        session.netAmount.toString(),
        session.paymentMethods.join('; '),
        session.closedAt,
        session.status
      ];
      // Escape quotes by replacing " with "" and wrap in quotes
      lines.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(','));
    }

    return lines.join('\n');
  }
}

