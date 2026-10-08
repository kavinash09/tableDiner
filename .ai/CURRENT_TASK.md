# CURRENT TASK

**Active Objective**: Role-Based Access Control (RBAC) & Multi-Tenant Route Authorization
**Started**: 2026-10-09

## Remediated Blueprint Status:
- [x] Issue 1 (P0): Session Closure Timestamps & Financial Snapshots Persistence (Completed & Tested)
- [x] Issue 2 (P0): Order Lifecycle Timestamps Persistence (`acceptedAt`, `readyAt`, `servedAt`, `cancelledAt`) (Completed & Tested)
- [x] Issue 4 (P0): Historical Session Data Backfill Script Execution (Completed & Tested)
- [x] Issue 3 (P1): Analytics Query In-Memory Performance Optimization (Completed & Tested)
- [x] Architectural Milestone: Event-Driven Analytics Platform Blueprint (Phases 1-10 Completed)

## Immediate Objective Sub-steps (RBAC & Tenant Isolation):
- [ ] Define User roles (`PLATFORM_ADMIN`, `RESTAURANT_ADMIN`, `KITCHEN_STAFF`) in schema and domain types.
- [ ] Implement Fastify authorization pre-handler hooks enforcing tenant scoping and role-based permissions.
- [ ] Eliminate `getCurrentRestaurant()` fallback from operational routes (`kitchen/orders`, `restaurant/current`).
- [ ] Add integration tests verifying 401/403 responses on unauthorized or cross-tenant route access.

## Next Up After This
- Phase 1 Execution of Event-Driven Analytics: Deploy `AnalyticsEvent` Outbox Model & Silent Event Capture.
- Mobile layout optimizations across tablet/mobile viewpoints for restaurant admin & customer web.
- Real-time kitchen dashboard event propagation.

