# Auth — Database Entities

## Entities

### `User`
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Display name |
| email | String | Unique; used as login identifier |
| password | String | bcrypt hash |
| tenantId | String? | Nullable FK → Tenant (platform admins may have no tenant) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Missing**: No `role` or `permissions` field. No `isActive` / `lockedAt` field.

### `Account`
Standard NextAuth `Account` table for OAuth provider links. Not actively used (only CredentialsProvider in use).

## Session Storage
**JWT only** — no `Session` table in the database. Session state lives entirely in the signed JWT cookie. Revocation requires secret rotation.

## Password Storage
Passwords are stored as bcrypt hashes. The `authorize()` callback uses `bcrypt.compare()` before issuing a token.

## Gaps
- No `role` enum or join table for RBAC.
- No `refreshToken` table — Auth.js JWT sessions expire per `maxAge` config with no refresh mechanism.
- No audit log for login attempts (success or failure).
