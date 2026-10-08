# 08 — Tenant Model

## Tenant Lifecycle State Machine

```
LEAD → ONBOARDING → ACTIVE → SUSPENDED → DECOMMISSIONED
                      ↑           |
                      └───────────┘  (re-activation path, if implemented)
```

| State | Meaning |
|-------|---------|
| `LEAD` | Prospective tenant, pre-signup |
| `ONBOARDING` | Account created; setup in progress |
| `ACTIVE` | Fully operational |
| `SUSPENDED` | Temporarily disabled (e.g., payment failure) |
| `DECOMMISSIONED` | Permanently shut down; data retained via soft deletes |

Field on `Tenant` model: `onboardingStatus: LEAD | ONBOARDING | ACTIVE | SUSPENDED | DECOMMISSIONED`

---

## Tenant Entity Fields

| Field | Type / Notes |
|-------|-------------|
| `id` | Primary key |
| `name` | Tenant display name |
| `onboardingStatus` | Enum (see state machine above) |
| (implied) | Relations to `User`, `Session`, `Order`, `OrderItem`, `Payment`, `Subscription`, `TenantAuditLog` |

---

## Isolation Strategy

**Isolation is application-level only. There is no database-level row-level security (RLS) or schema separation.**

- Every query scoped to a tenant must explicitly filter by `tenantId` in application code.
- A missing `WHERE tenantId = ?` clause in any repository method will silently leak cross-tenant data.
- No ORM-level global filter (e.g., Prisma middleware) is confirmed to enforce this automatically.

> [!CAUTION] There is no database-enforced tenant boundary. A single missed filter in any Prisma query is a data isolation breach.

---

## tenantId Denormalization Rationale

`tenantId` is denormalized onto: `Session`, `Order`, `OrderItem`, `Payment`.

**Why:** Cross-tenant analytics queries (e.g., platform dashboard) can aggregate across all rows of a single table without joining back through the tenant relation chain. This is a deliberate performance trade-off documented in DECISIONS.md ("Chose denormalized tenantId for analytics performance").

**Trade-off:** `tenantId` on child records must be kept consistent with the parent tenant; writes require setting it explicitly on each record.

---

## Subscription Model

| Field | Values / Notes |
|-------|---------------|
| `billingCycle` | `MONTHLY` \| `YEARLY` |
| `status` | `ACTIVE` \| `PAST_DUE` \| `CANCELED` |
| `mrr` | Monthly Recurring Revenue tracked per tenant |

One subscription per tenant. Used by `GetPlatformDashboardUseCase` and `GetEODAuditReportUseCase` for revenue analytics.

---

## Audit Log Model (`TenantAuditLog`)

| Field | Notes |
|-------|-------|
| `tenantId` | Foreign key to Tenant |
| `actor` | Identity of the user/system that performed the action |
| `action` | Free-text string describing the event |
| (implied) `createdAt` | Timestamp |

No structured event enum — `action` is a plain string. Used by `GetEODAuditReportUseCase`.

---

## Known Gaps

### `getCurrentRestaurant()` MVP Hack

`getCurrentRestaurant()` uses `findFirst()` with no tenant filter — it returns the first restaurant in the database regardless of which tenant is making the request. This is an explicit MVP shortcut and **must be replaced** before multi-tenant production deployment.

### No RBAC on Routes

- The `User` model has no `role` or `permissions` field.
- Route handlers do not enforce tenant-scoped authorization beyond the presence of a valid JWT.
- Any authenticated user with a valid token can potentially invoke any route — tenant isolation relies entirely on correct `tenantId` filtering in use cases.

### No Subscription Enforcement

`onboardingStatus: SUSPENDED` or `Subscription.status: PAST_DUE | CANCELED` does not currently gate API access. A suspended tenant's token remains valid.
