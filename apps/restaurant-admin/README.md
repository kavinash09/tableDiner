# TableDiner Restaurant Admin (`@tablediner/restaurant-admin`)

The internal React/Vite dashboard used by restaurant staff (chefs, expediters, and front-of-house). It includes a real-time Kanban board for kitchen order management, menu editing, and a daily operational metrics dashboard.

## 🚀 Getting Started (Development)

Run the dev server from the monorepo root:
```bash
pnpm dev
```
Or to run this specific app:
```bash
cd apps/restaurant-admin
pnpm dev
```
*(Runs on `http://localhost:5174`)*

## 🔑 Default Login Credentials
- **Email:** `admin@tablediner.com`
- **Password:** `password123`
*(These credentials are created by the `packages/db/seed.ts` script)*

## ⚙️ Environment Variables

Create a `.env.local` file:
```env
VITE_API_URL=http://localhost:3001
```

## 📂 Key Files & Architecture

- `src/App.tsx` — Handles route-level tab switching (Kitchen / Menu / Settings / Analytics).
- `src/components/KitchenDashboard.tsx` — The core Kanban interface that polls for order state changes (ACCEPTED -> PREPARING -> READY -> SERVED).
- `src/AuthContext.tsx` — Handles credential authentication via NextAuth backend endpoints.
