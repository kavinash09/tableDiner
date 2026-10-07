# DECISIONS LOG

### Initial Setup Decisions
- **Architecture**: Monorepo utilizing `pnpm workspaces`.
- **Backend**: Fastify API.
- **Frontend**: React.
- **Database**: SQLite for pilot phase. Prisma as ORM and ultimate source of truth.
- **Business Logic**: One active `Session` per table at a time. A `Payment` officially closes a session.

### 2026-10-08: Data Foundations (Chapter 1)
- **Schema Expansion**: Added `MenuCategory` to organize `MenuItem`s. Added `OrderItem` to handle quantities. Added `qrCode` token to `Table`.
- **Process**: Established `docs/IMPLEMENTATION_MAP.md` as the blueprint.
- **Agent Guardrails**: Instituted the "State Checkpoint Protocol" to ensure `.ai` files are perfectly maintained via `AGENTS.md`.

### 2026-10-08: Monorepo Setup (Chapter 2)
- **Tooling**: Standardized on `pnpm-workspace.yaml` grouping `apps/*` and `packages/*`.
- **Packages**: Initialized `@tablediner/*` namespaces for all internal dependencies.
- **Base Config**: Added a unified `tsconfig.base.json` at the root.

### 2026-10-08: API & Web Foundations (Chapter 3)
- **API Framework**: Chose `fastify` combined with `@fastify/cors`.
- **API Data Fetching**: Created `GET /table/:qrCode` route that aggressively includes nested Prisma relations to minimize roundtrips.
- **Web Framework**: Chose standard React + Vite for `customer-web`. It parses the `?qr=` URL parameter.
- **Seeding**: Wrote `packages/db/seed.ts` to mock out "The Rusty Spoon" restaurant.

### 2026-10-08: Kitchen Dashboard & UI Rules (Chapter 4)
- **Currency**: Enforced Rule #12 across the entire monorepo -> All prices rendered and processed in **Rupees (₹)**.
- **Responsive Rules**: Enforced Rule #13 -> Mobile-first and Tablet flex-wrap rules applied to all UI apps.
- **Dashboard Tech**: Used 5-second HTTP polling for the kitchen Kanban board instead of WebSockets to keep the MVP strictly boring and simple.

### 2026-10-08: Cart & Checkout (Chapter 5)
- **UI UX**: Built a sticky floating checkout bar on mobile (`customer-web`) so the user can easily place orders while scrolling the menu.
- **Session Auto-Creation**: Decided to implicitly create an `ACTIVE` Session on the backend if one doesn't exist when the very first order is placed by a table.

### 2026-10-08: Platform Admin Setup (Chapter 6)
- **API Extension**: Added super-admin API routes (`GET /admin/restaurants` and `POST /admin/restaurants`) to `apps/api/src/index.ts` to manage multi-tenancy.
- **Platform Admin UI**: Built `apps/platform-admin` using React and Vite, conforming to the mobile-first and tablet flex-wrap design rules. It allows creating new tenants, restaurants, and generating `tablesCount` tables which produce QR codes on-demand.
- **Workflow Correctness**: Re-affirmed strict adherence to appending the decisions log to avoid data loss.

### 2026-10-08: Pivoting back to Core MVP (Chapter 5)
- **Course Correction**: Acknowledged that focusing on the multi-tenant Platform Admin was going overboard before the core payment loop was completed. Pivoted back to finishing Chapter 5.
- **Billing API**: Added `GET /table/:qrCode/bill` to fetch a running total for the active session, properly calculating line items.
- **Payment API**: Added `POST /table/:qrCode/pay` which mocks a successful payment, creates a `Payment` database record, and transitions the `Session` status to `CLOSED`.
- **Customer Checkout UI**: Updated `apps/customer-web` with a "View Bill / Pay" modal. It fetches the itemized bill, displays the total, and allows the user to close the tab, satisfying the complete TableDiner user journey.
