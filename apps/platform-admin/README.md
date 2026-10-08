# TableDiner Platform Admin (`@tablediner/platform-admin`)

The internal React/Vite dashboard used by the "super admins" of the TableDiner SaaS platform. It provides high-level observability into total GMV, MRR, new tenant onboarding, and active table generation.

## 🚀 Getting Started (Development)

Run the dev server from the monorepo root:
```bash
pnpm dev
```
Or to run this specific app:
```bash
cd apps/platform-admin
pnpm dev
```
*(Runs on `http://localhost:5175`)*

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

- `src/App.tsx` — Handles the main application layout and the "Tenants vs Analytics" tab switching.
- `src/components/Dashboard.tsx` — Fetches and displays platform-wide KPIs (e.g., MRR, Funnel conversion, global tables active).
- `src/AuthContext.tsx` — Secure context provider for managing session state.
