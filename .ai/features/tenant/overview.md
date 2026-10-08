# Tenant — Overview

## Business Purpose
Platform-level tenant management. A Tenant represents one paying customer (e.g., a restaurant group) on the TableDiner SaaS platform. Each Tenant owns one or more Restaurants, their Users, and their billing Subscription.

## Entity Lifecycle

```
LEAD → ONBOARDING → ACTIVE → SUSPENDED → DECOMMISSIONED
```

| Status | Meaning |
|---|---|
| LEAD | Pre-sales; account created but not yet provisioned |
| ONBOARDING | Restaurant + tables being configured |
| ACTIVE | Fully live; orders can be placed |
| SUSPENDED | Billing failure or admin action |
| DECOMMISSIONED | Permanently disabled; soft-deleted |

## State Machine

```
LEAD ──► ONBOARDING ──► ACTIVE ──► SUSPENDED ──► DECOMMISSIONED
                                       ▲                │
                                       └────────────────┘ (reactivation not yet implemented)
```

## Subscription Tracking
`Subscription.mrr` records monthly recurring revenue per billing cycle. `nextBillingDate` drives renewal cadence. No real payment gateway is integrated — MRR is manually maintained.

## Responsibilities
- `POST /admin/restaurants` — provision a new Tenant + Restaurant + Tables atomically.
- `GET /admin/restaurants` — return all Tenants with nested Restaurants and Tables.

## Current Limitations
- No RBAC: admin routes are unprotected.
- `onboardingStatus` is stored but never enforced by route guards.
- No suspension logic is implemented.
- No real subscription billing integration.
- `TenantAuditLog` schema exists; no use-case writes to it yet.
