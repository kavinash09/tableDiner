# Auth — API

All auth routes are under the prefix `ALL /api/auth/*`, proxied from Fastify to the Auth.js handler.

## Key Sub-routes

### `GET /api/auth/csrf`
Returns a CSRF token. Must be called before any sign-in attempt.

**Response**
```json
{ "csrfToken": "string" }
```

---

### `POST /api/auth/callback/credentials`
Authenticates a user with email + password.

**Body** (`application/x-www-form-urlencoded`)
```
email=user@example.com&password=secret&csrfToken=<token>
```

**Success**: Redirects (or returns manual response) with session cookie set.
**Failure**: Redirects to error page / returns error state.

**Note**: SPA must call with `redirect: 'manual'` to avoid opaqueredirect crash.

---

### `GET /api/auth/session`
Returns the current JWT session payload for the authenticated user.

**Response (authenticated)**
```json
{ "user": { "id": "...", "name": "...", "email": "..." }, "expires": "..." }
```

**Response (unauthenticated)**
```json
{}
```

---

### `POST /api/auth/signout`
Invalidates the JWT session (client-side token cleared).

**Response**: Redirect to home or JSON `{}`.

## Gaps
- No routes enforce RBAC post-authentication.
- No route to manage users (create, update password, assign roles).
