# Tenant — Database Entities

## Entities

### `Tenant`
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Unique display name |
| onboardingStatus | Enum | LEAD / ONBOARDING / ACTIVE / SUSPENDED / DECOMMISSIONED |
| isActive | Boolean | Convenience flag, mirrors status |
| deletedAt | DateTime? | Soft-delete timestamp |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### `Subscription`
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | FK → Tenant |
| billingCycle | Enum | MONTHLY / ANNUAL |
| mrr | Float | Monthly recurring revenue |
| nextBillingDate | DateTime | |
| status | Enum | ACTIVE / PAST_DUE / CANCELLED |

### `TenantAuditLog`
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | FK → Tenant |
| actorId | String | FK → User |
| action | String | Free-text event name |
| createdAt | DateTime | |

## Relationships
- `Tenant` → `Restaurant` (1 : N)
- `Tenant` → `User` (1 : N)
- `Tenant` → `Subscription` (1 : N)
- `Tenant` → `TenantAuditLog` (1 : N)
