# 10 — Decision Summary

## Infrastructure

| Decision | Why | Trade-off | Reversal Trigger |
|----------|-----|-----------|-----------------|
| SQLite as database | Zero-config for MVP; no separate DB process | Single-writer bottleneck; unsuitable for multi-region or high concurrency | Any production multi-tenant load; need for concurrent writes |
| Fastify over Express | Better performance, TypeScript-first, built-in schema validation | Smaller ecosystem; fewer middleware options | Team familiarity issues or ecosystem gap |
| pnpm workspaces for monorepo | Efficient disk usage, strict hoisting, fast installs | Less common than npm/yarn workspaces; some tooling gaps | CI tooling incompatibility |
| `tsx` over `ts-node` | `ts-node` broke with TypeScript 5+; `tsx` is faster and compatible | `tsx` is less battle-tested | `tsx` introduces a regression; ts-node resolves TS5 compat |
| `@aws-sdk/client-s3` for uploads | S3-compatible interface works with many providers (Minio, R2, AWS) | Adds AWS SDK weight to API bundle | Switch to a provider-specific SDK for cost/perf reasons |

---

## Architecture

| Decision | Why | Trade-off | Reversal Trigger |
|----------|-----|-----------|-----------------|
| Hexagonal Architecture (ports & adapters) | Domain logic is isolated from infrastructure; adapters are swappable | More boilerplate; steeper onboarding for small teams | Team size stays small and velocity suffers from indirection |
| 5-second polling for kitchen orders | Simple to implement; no WebSocket infra required | 5s latency on order updates; unnecessary network traffic when idle | Order volume grows and latency becomes operationally problematic |
| Soft deletes (`ArchivableEntity`) | Preserves historical data for analytics and audit | Queries must always filter `deletedAt IS NULL`; risk of stale data leaking | Compliance requirement to hard-delete PII (GDPR right to erasure) |
| Manual CSV generation (no csv library) | Reduces dependency surface for EOD report | Error-prone for edge cases (quoting, encoding); no library safety net | CSV edge-case bugs in production; team adopts a safe csv lib |

---

## Auth

| Decision | Why | Trade-off | Reversal Trigger |
|----------|-----|-----------|-----------------|
| Auth.js (`@auth/core`) over custom JWT | Provides CSRF, OAuth, session management out of the box | Opaque internals; harder to debug; Fastify integration is non-standard | Auth.js upgrade breaks Fastify adapter; need for fine-grained session control |
| JWT (stateless) sessions | No session store required; horizontally scalable | Tokens cannot be invalidated before expiry; logout is cosmetic only | Security incident requiring immediate token revocation |
| Credentials provider (email + bcrypt) | Simple for MVP; no OAuth dependency required | Password management burden; no SSO | Enterprise tenants require SSO/SAML |
| `redirect:'manual'` + opaqueredirect | Prevents Auth.js 302 redirect from breaking SPA fetch flow | Non-obvious pattern; breaks if Auth.js changes redirect behaviour | Auth.js provides a proper SPA/fetch-compatible response mode |
| `AUTH_SECRET` env fallback to hardcoded string | Prevents crash in dev when env var absent | **Critical security risk** — any deployment without the env var is fully compromised | Immediately: enforce required env var at startup; remove fallback |

---

## Data

| Decision | Why | Trade-off | Reversal Trigger |
|----------|-----|-----------|-----------------|
| Denormalized `tenantId` on `Session`, `Order`, `OrderItem`, `Payment` | Cross-tenant analytics queries avoid multi-hop joins; improves dashboard performance | `tenantId` must be written consistently on every insert; schema coupling | Normalization is preferred once an ORM-level global filter enforces tenant isolation |
| Application-level tenant isolation (no RLS) | SQLite does not support RLS; simpler to implement in app code | A single missing `WHERE tenantId = ?` is a silent data breach | Move to PostgreSQL with RLS for hard isolation guarantee |
| `getCurrentRestaurant()` using `findFirst()` | MVP shortcut; single restaurant per dev environment | Non-tenant-aware; returns arbitrary restaurant in multi-tenant DB | Before any multi-tenant production deployment |
| `@auth/prisma-adapter` for OAuth accounts | Future-proofs OAuth login without schema migration | Adapter adds `Account`/`Session` tables unused by current JWT-only flow | OAuth providers are confirmed never to be added |

---

## Testing

| Decision | Why | Trade-off | Reversal Trigger |
|----------|-----|-----------|-----------------|
| Minimal test suite (3 tests) | MVP velocity; avoid over-engineering tests before domain stabilises | No regression safety net; high risk on refactors | Any refactor of Order state machine, payment flow, or auth |
| Unit test for `GetEODAuditReportUseCase` with mocked repository | Isolates domain logic from DB; fast | Does not catch repository query bugs | Prisma query regressions appear in production |

---

## Frontend

| Decision | Why | Trade-off | Reversal Trigger |
|----------|-----|-----------|-----------------|
| Raw `fetch` in `AuthContext` (no Auth.js client) | No Next.js / Auth.js client-side SDK available for Vite SPAs | Manual session state management; brittle redirect handling | Official Auth.js Vite/SPA client becomes available |
| `qrcode.react` in `restaurant-admin` only | Only restaurant admin generates table QR codes | Isolated dependency; not shared | Customer-web needs to render QR codes |
| Shared types via `@tablediner/shared-types` | Single source of truth for DTOs between API and all frontends | Type changes require coordinated publish across all apps | Frontends diverge enough to need separate type contracts |
