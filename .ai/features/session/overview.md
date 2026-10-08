# Session Feature Overview

## Business Purpose
A Session represents a customer seating event at a table. It tracks the entire lifecycle of a customer visit, from the first order placed to the final payment made.

## Responsible For
- Grouping multiple `Order` entities under a single customer visit.
- Managing the state of the table (OPEN vs CLOSED).
- Serving as the primary entity for financial aggregation (subtotal, tax, tip, total).

## Current Limitations
- BUG: Status `'ACTIVE'` is used in Prisma queries, but the schema uses `'OPEN'`.
- BUG: `tenantId` and `businessDate` are not populated upon creation.
- The `TableSession` domain entity exists but is bypassed by the current use cases, leading to scattered business logic.

