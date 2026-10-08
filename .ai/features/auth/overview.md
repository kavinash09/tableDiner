# Auth — Overview

## Business Purpose
User authentication for the admin-facing SPAs (`restaurant-admin`, `platform-admin`). Implements email + bcrypt password authentication via Auth.js (NextAuth v5) with JWT sessions, bridged into the Fastify backend.

## Flow

```
SPA → GET /api/auth/csrf          → obtain CSRF token
    → POST /api/auth/callback/credentials (email, password, csrfToken)
    → GET /api/auth/session        → hydrate app with user identity
    → POST /api/auth/signout       → clear session
```

## Provider
`CredentialsProvider` — validates `email` + `password` against the `User` table (bcrypt compare). Issues a JWT session on success.

## Frontend Requirements
- Must use `redirect: 'manual'` on the credentials callback fetch to avoid opaque redirect crashes in the SPA.
- CSRF token must be fetched and included before every sign-in attempt.

## Security Issues

> [!CAUTION]
> **`AUTH_SECRET`** falls back to a hardcoded string if the environment variable is not set. This makes JWT tokens predictable in any environment where the env var is missing.

> [!CAUTION]
> **No RBAC**: No role or permission field on `User`. Any authenticated user can access any restaurant's data regardless of tenancy.

> [!WARNING]
> **No tenant scoping**: Authenticated JWT sessions do not carry `tenantId`. Cross-tenant data access is not prevented.
