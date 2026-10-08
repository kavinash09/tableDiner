# Shared Validation (`@tablediner/shared-validation`)

This package contains strict `Zod` schemas that dictate the exact payload structure required for any state-mutating requests (POST, PATCH, PUT) across the system.

## 🚀 Purpose
Provides a single source of truth for runtime validation.

1. **Backend (`apps/api`)**: Uses these schemas to run `.safeParse(request.body)` before any business logic executes, rejecting malformed inputs instantly.
2. **Frontend (React Apps)**: Can use these same schemas in conjunction with tools like `react-hook-form` to provide instant, client-side validation using the exact same rules as the server.

## 📂 Key Files
- `src/index.ts` — Exports Zod schemas like `PlaceOrderSchema`, `PaySchema`, and `CreateRestaurantSchema`.

## 🛠️ Usage
In any app within the monorepo:
```typescript
import { PlaceOrderSchema } from '@tablediner/shared-validation';

const result = PlaceOrderSchema.safeParse(payload);
if (!result.success) {
  console.error(result.error);
}
```
