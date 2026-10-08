# 09 — Auth Model

## Auth Stack

| Layer | Technology |
|-------|-----------|
| Auth framework | Auth.js (`@auth/core`) |
| Session strategy | JWT (stateless — no server-side session store) |
| Credential provider | `@auth/core/providers/credentials` |
| Database adapter | `@auth/prisma-adapter` (persists OAuth `Account` rows; not used for JWT sessions) |
| Password hashing | `bcryptjs` |
| Transport | `authRoute.ts` registered as a Fastify route handler |
| CSRF | Auth.js built-in CSRF token on callbacks |

---

## User Entity

| Field | Type / Notes |
|-------|-------------|
| `id` | Primary key |
| `name` | Display name |
| `email` | Unique; used as login identifier |
| `password` | bcrypt hash; nullable (OAuth users may have no password) |
| `tenantId` | Nullable FK to Tenant; platform admins may have `null` |

**`Account` model** — NextAuth OAuth accounts table (provider + providerAccountId). Managed by `@auth/prisma-adapter`.

No `role`, `permissions`, or `isAdmin` field exists on `User`.

---

## Auth Flow

```
Client (browser/React)
    │
    │  POST /auth/callback/credentials
    │  Content-Type: application/x-www-form-urlencoded
    │  Body: email=...&password=...&csrfToken=...
    ▼
authRoute.ts  (Fastify handler)
    │
    ├─ @fastify/formbody parses body (prevents HTTP 415)
    │
    ├─ Auth.js toWebRequest() → processes request
    │
    ├─ CredentialsProvider.authorize()
    │   ├─ prisma.user.findUnique({ where: { email } })
    │   └─ bcryptjs.compare(password, user.password)
    │
    ├─ On success: Auth.js issues signed JWT
    │   └─ JWT signed with AUTH_SECRET
    │
    └─ Response: Set-Cookie (session token) + redirect
```

---

## CSRF Flow

Auth.js requires a CSRF token for all `POST /auth/callback/*` requests.

```
1. Client: GET /auth/csrf  →  receives { csrfToken }
2. Client: POST /auth/callback/credentials
          body includes csrfToken field
3. Auth.js validates csrfToken before processing credentials
```

CSRF token is generated and validated internally by `@auth/core`. No custom CSRF implementation.

---

## Session Lifecycle

```
Login success
    → JWT created, signed with AUTH_SECRET
    → Sent to client as HttpOnly cookie

Subsequent requests
    → Client sends cookie automatically
    → authRoute (or Auth.js session check) verifies JWT signature
    → Session data decoded from token (stateless — no DB lookup per request)

Logout
    → Client calls POST /auth/signout
    → Auth.js clears the session cookie
    → JWT is not blocklisted (stateless; token remains valid until expiry if intercepted)
```

---

## Security Concerns

> [!CAUTION] **Hardcoded AUTH_SECRET fallback** — `authRoute.ts` falls back to `"super-secret-key-for-mvp-only"` if `AUTH_SECRET` env var is absent. Any deployment without this env var set is cryptographically insecure. All JWTs can be forged by anyone who knows this string.

| Concern | Detail |
|---------|--------|
| Hardcoded secret | `AUTH_SECRET` fallback = `"super-secret-key-for-mvp-only"` |
| No JWT blocklist | Signed-out tokens remain valid until expiry |
| No role on User | JWT payload carries no role/permission claims |
| No tenant-scoping in auth | JWT does not enforce tenant isolation; use cases must do it |
| No token rotation | Long-lived JWTs with no refresh rotation |

---

## Frontend Integration Pattern

Frontend apps (`restaurant-admin`, `platform-admin`) do not use an Auth.js client library. They use raw `fetch` against the API auth endpoints, managed in a React `AuthContext`.

**SPA redirect fix:** Auth.js normally issues HTTP 302 redirects after login. SPAs intercept this with:

```ts
fetch('/auth/callback/credentials', {
  method: 'POST',
  redirect: 'manual',   // prevents browser from following redirect
  body: formData,
})
// response.type === 'opaqueredirect' → treat as success
```

This pattern is used in `restaurant-admin/AuthContext.tsx` and `platform-admin/AuthContext.tsx`. Documented in DECISIONS.md as "SPA redirect fix: redirect:'manual' + opaqueredirect handling".

---

## Missing Features

| Feature | Status |
|---------|--------|
| Role-based access control | ❌ No `role` field on `User`; no route-level enforcement |
| Tenant-scoped auth | ❌ JWT does not bind a user to a tenant; enforced only in use-case layer |
| OAuth login | ⚠️ `Account` model and `@auth/prisma-adapter` present but no OAuth provider configured |
| Token refresh / rotation | ❌ Not implemented |
| Audit log on auth events | ❌ Login/logout not recorded in `TenantAuditLog` |
| Rate limiting on `/auth/callback` | ❌ No brute-force protection |
