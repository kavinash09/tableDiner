import { describe, it, expect, vi } from 'vitest';
import { GetEODAuditReportUseCase } from '../core/use-cases/GetEODAuditReportUseCase';
import { RestaurantAnalyticsRepository } from '../core/ports/RestaurantAnalyticsRepository';
import { DailyFinancialMetrics, EodSessionRecord } from '@tablediner/shared-types';

describe('GetEODAuditReportUseCase', () => {
  it('should fetch financial summary and eod sessions and return a unified report', async () => {
    // Arrange
    const mockFinancialSummary: DailyFinancialMetrics = {
      grossRevenue: 1000,
      netRevenue: 850,
      totalDiscounts: 50,
      totalTips: 100,
      refundedRevenue: 0,
      avgTicketSize: 425
    };

    const mockSessions: EodSessionRecord[] = [
      {
        sessionId: 's1',
        tableName: 'T1',
        guestCount: 2,
        grossAmount: 500,
        discountAmount: 0,
        taxAmount: 25,
        tipAmount: 50,
        netAmount: 425,
        paymentMethods: ['CARD'],
        closedAt: '2026-10-09T18:00:00.000Z',
        status: 'CLOSED'
      },
      {
        sessionId: 's2',
        tableName: 'T2',
        guestCount: 2,
        grossAmount: 500,
        discountAmount: 50,
        taxAmount: 25,
        tipAmount: 50,
        netAmount: 425,
        paymentMethods: ['UPI'],
        closedAt: '2026-10-09T19:00:00.000Z',
        status: 'CLOSED'
      }
    ];

    const mockRepo: RestaurantAnalyticsRepository = {
      getFinancialMetrics: vi.fn().mockResolvedValue(mockFinancialSummary),
      getOrderMetrics: vi.fn(),
      getUtilizationMetrics: vi.fn(),
      getSlaMetrics: vi.fn(),
      getEodSessions: vi.fn().mockResolvedValue(mockSessions)
    };

    const useCase = new GetEODAuditReportUseCase(mockRepo);

    // Act
    const result = await useCase.execute('rest123', '2026-10-09');

    // Assert
    expect(mockRepo.getFinancialMetrics).toHaveBeenCalledWith('rest123', '2026-10-09');
    expect(mockRepo.getEodSessions).toHaveBeenCalledWith('rest123', '2026-10-09');
    expect(result).toEqual({
      businessDate: '2026-10-09',
      financialSummary: mockFinancialSummary,
      sessions: mockSessions
    });
  });
});

