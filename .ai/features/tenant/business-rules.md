# Tenant — Business Rules

## Rules

| # | Rule |
|---|---|
| BR-T1 | A Tenant must have ≥ 1 Restaurant. |
| BR-T2 | `onboardingStatus` drives platform access (not currently enforced by route guards). |
| BR-T3 | `Subscription.mrr` tracks monthly recurring revenue per billing cycle. |
| BR-T4 | All significant Tenant events must be appended to `TenantAuditLog` (actorId, action, createdAt). |
| BR-T5 | Soft-delete only — no hard deletes on Tenant or any child entity. `deletedAt` timestamp marks deletion. |
| BR-T6 | `tenantId` must be present on all child entities (Restaurant, User, Session, Order, Payment). |

## Known Violations / Missing Implementations

- **No route guards** enforce `onboardingStatus`; a SUSPENDED tenant can still hit all routes.
- **No suspension logic** is implemented in any use case.
- **`TenantAuditLog`** table exists in schema but no code writes to it.
- **`tenantId`** is NOT populated during Session, Order, or Payment creation (see ordering and billing feature packs).
