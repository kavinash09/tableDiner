# Auth — Tests

## Existing Tests
**1 test** — `authRoute.test.ts`: asserts that a `application/x-www-form-urlencoded` auth request does **not** return HTTP 415 (Unsupported Media Type). Verifies content-type bridging between Fastify and Auth.js.

## Missing Tests

| Type | Description |
|---|---|
| Unit | `CredentialsProvider.authorize()` — valid email + correct password → returns user object |
| Unit | `CredentialsProvider.authorize()` — valid email + wrong password → returns `null` |
| Unit | `CredentialsProvider.authorize()` — missing email or password → returns `null` |
| Unit | `CredentialsProvider.authorize()` — unknown email → returns `null` |
| Integration | Full login flow: CSRF fetch → credentials callback → session fetch → assert user in session |
| Integration | Sign-out: POST `/api/auth/signout` → subsequent session fetch returns `{}` |
| Integration | Session expiry: expired JWT → `GET /api/auth/session` returns `{}` |
| Security | `AUTH_SECRET` not set → assert startup fails or warns rather than falling back to hardcoded value |
