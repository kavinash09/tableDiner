# Tenant — Tests

## Existing Tests
**None.** 0 test files cover the tenant feature.

## Missing Tests

| Type | Description |
|---|---|
| Unit | `createPlatformTenant` use case — happy path: assert Tenant + Restaurant + Tables created atomically |
| Unit | `createPlatformTenant` — duplicate tenant name → error |
| Unit | `createPlatformTenant` — `tablesCount = 0` → validation error |
| Integration | `POST /admin/restaurants` — happy path: 201 + correct response shape |
| Integration | `POST /admin/restaurants` — missing required fields → 400 |
| Integration | `GET /admin/restaurants` — returns all tenants with nested restaurants and tables |
| Integration | `GET /admin/restaurants` — empty platform → returns `[]` |
