# Auth — Business Rules

## Rules

| # | Rule |
|---|---|
| BR-AUTH1 | Only `User` records with a matching `email` + valid bcrypt `password` can authenticate. |
| BR-AUTH2 | A JWT session token is issued on successful authentication. Session is stateless — no session row in DB. |
| BR-AUTH3 | A valid CSRF token must accompany every `POST /api/auth/callback/credentials` request. |
| BR-AUTH4 | Frontend SPAs must use `redirect: 'manual'` when calling the credentials callback to prevent opaqueredirect errors. |
| BR-AUTH5 | Session validity is checked via `GET /api/auth/session` on application load. |

## Security Violations

> [!CAUTION]
> **`AUTH_SECRET` hardcoded fallback**: If `process.env.AUTH_SECRET` is absent, a hardcoded string is used. Any environment missing the env var is exploitable — tokens can be forged.

> [!CAUTION]
> **No RBAC**: `User` has no `role` or `permissions` field. No route checks authenticated user identity against the resource being accessed. A restaurant manager can access another restaurant's data.

> [!WARNING]
> **No tenant scoping in JWT**: The JWT payload does not include `tenantId`. Downstream services cannot validate tenant ownership from the token alone.

## Missing Implementations
- Password reset flow.
- Account lockout after N failed attempts.
- Token refresh / expiry handling beyond Auth.js defaults.
- Role assignment and enforcement.
