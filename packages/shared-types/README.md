# Shared Types (`@tablediner/shared-types`)

This package acts as the strict typing contract between the backend (`apps/api`) and the multiple frontend React applications.

## 🚀 Purpose
To prevent "drift" between API responses and UI expectations. If an API route changes its JSON signature, it must be reflected here first, which will immediately surface TypeScript errors in any affected frontend codebase.

## 📂 Key Files
- `src/index.ts` — Contains interfaces for entities (e.g., `TableSession`, `MenuItem`) and specific API response shapes (e.g., `RestaurantDashboardResponse`, `PlatformDashboardResponse`).

## 🛠️ Usage
In any app within the monorepo:
```typescript
import type { OrderState, MenuItem } from '@tablediner/shared-types';
```
