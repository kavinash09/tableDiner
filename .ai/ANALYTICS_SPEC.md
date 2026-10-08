# TableDiner Analytics & Reporting Specification (v1)

## Purpose
This document defines the analytics, reporting, dashboard architecture, business metrics, reporting rules, and technical implementation strategy for TableDiner.

The goal is to support:
1. Restaurant Owners (Tenants)
2. Platform Administrators (Super Admins)
while maintaining scalability from MVP through multi-tenant SaaS growth.

---

# Analytics Principles

## Guiding Principles

### Rule 1: Business Day ≠ Calendar Day
Restaurants frequently operate past midnight. Reporting must use a configurable Business Day instead of UTC or local calendar dates.
*Example:*
Restaurant cutoff: 04:00 AM
Session closes: 01:30 AM
Reporting Date: Previous Business Day

### Rule 2: Store UTC, Report in Tenant Timezone
All timestamps stored: UTC
All reports generated using: Tenant Timezone (e.g., Asia/Kolkata, America/New_York)

### Rule 3: Reporting Must Be Rebuildable
Restaurant data changes after closing: Refunds, Reopened Sessions, Discounts, Item Voids.
Therefore: Daily rollups must be idempotent. Never use permanent counter increments.

---

# Restaurant Owner Dashboard

## Module 1: Today Overview
- **Revenue**: Gross, Net, Total Discounts, Total Tips, Average Ticket Size.
- **Orders**: Total, Completed, Cancelled, Cancellation Rate.
- **Guests**: Covers Served, Average Party Size.
- **Utilization**: Occupancy %, Table Turnover Rate.

## Module 2: Revenue & Financial Analytics
- **Core Revenue**: Gross, Net, Avg Ticket, Total Tips.
- **Revenue Quality**: Revenue Per Cover, Cancelled Revenue, Refunded Revenue, Discount %, Void Amount.

## Module 3: Guest Analytics
- **Metrics**: Covers Served, Average Party Size, Revenue Per Cover.
- **Trends**: Lunch vs Dinner covers, Peak Hour.

## Module 4: Table Utilization Analytics (Crucial)
- **Occupancy Metrics**: Occupied Table Minutes, Available Minutes, Occupancy %.
- **Turnover Metrics**: Avg Table Turn Time, Turnover Rate.
- **Peak**: Peak Occupancy Hour, Busiest Table.

## Module 5: Order Analytics
- **Order Metrics**: Total, Completed, Cancelled, Cancel Rate.
- **Menu Intelligence**: Top Sellers, Bottom Sellers, Most Cancelled, Most Voided.
- **Revenue Intelligence**: By Item, By Category, By Hour, By Day.

## Module 6: Operational SLA Dashboard
- **Kitchen Metrics**: Avg Prep Time (`readyAt - acceptedAt`), Fastest, Slowest.
- **Bottlenecks**: Wait-To-Accept, Service Time, Full Fulfillment.

## Module 7: Payment Analytics
- **Metrics**: Payment Method Breakdown (Cash/UPI/Card), Payment Mix %, Failure Rate, Settlement Gap.

## Module 8: End Of Day Audit (EOD)
- **Summary**: Financial & Payment summary.
- **Session Ledger**: Every closed session, table, guest count, amount, payment method, closedBy.
- **Audit Events**: Manual Cancellations, Discounts, Voids, Refunds, Reopened Sessions.

---

# Platform Admin Dashboard

## Module 1: SaaS Financials
- **Metrics**: MRR, ARR, New MRR, Expansion, Contraction, Churned MRR, Churn Rate.

## Module 2: Platform GMV
- **Global Metrics**: GMV, Orders Processed, Sessions Processed, Avg Order Value.

## Module 3: Tenant Funnel
- **States**: LEAD, TRIAL, ACTIVE, PAUSED, SUSPENDED, DECOMMISSIONED.

## Module 4: Tenant Adoption
- **Activity**: Daily/Weekly/Monthly Active Restaurants (DAR/WAR/MAR).
- **Usage**: Orders Created, Sessions Opened, Dashboard Logins.

## Module 5: Tenant Health Score
- **Signals**: Usage trend, Billing signals (Failed payments). Categories: Healthy, Warning, At Risk, Inactive.

## Module 6: Platform Operations
- **Metrics**: API Request Volume, Error Rate, Tenant Onboarding Time.

---

# Reporting Edge Cases

## Business Day Cutoff
Restaurant Config: `businessDayCutoffHour` (e.g. 4 AM). Midnight crossovers must belong to the same business day.

## Reopened Sessions
Session States: OPEN, CLOSED, REOPENED, FINALIZED.
Audit Fields: `reopenedAt`, `reopenedBy`, `reopenReason`.

## Retroactive Changes
Must support refunds, discounts, voids after original close. Must trigger rollup recalculation.

---

# Technical Strategy

## MVP Query Strategy
Use Prisma Aggregations (`aggregate()`, `groupBy()`) directly against indexed tables. No rollups required initially.

## Required Database Indexes
- **Sessions**: `tenantId, businessDate`, `createdAt`, `closedAt`, `status`
- **Orders**: `tenantId`, `acceptedAt`, `readyAt`, `servedAt`, `status`

## Scale Architecture (Post-MVP)
Run nightly rollup jobs (02:00 AM Local). Idempotent rollups (Delete Snapshot -> Recalculate -> Upsert).

## Analytics Architecture
- **Domain Layer**: KPI Definitions, Business Day Logic.
- **Use Cases**: GetRestaurantDashboard, GetEODReport, GenerateDailyRollup.
- **Adapters**: PrismaAnalyticsRepository.

