# TableDiner: Project Intelligence Pack

## 1. Executive Summary
- **Product**: TableDiner is an AI-first, multi-tenant SaaS platform for restaurants, featuring QR code-based dining, kitchen management, and platform administration.
- **Target Users**: 
  - **Diners**: Scan QR codes to browse menus, order, and pay.
  - **Kitchen/Staff**: Manage live orders via a tablet-optimized Kanban dashboard.
  - **Restaurant Managers**: Track daily analytics, SLA metrics, and generate EOD audits.
  - **Platform Super-Admins**: Onboard tenants and monitor global revenue/metrics.
- **Main Workflows**: QR scanning -> Cart Checkout -> Live Kitchen Ticket -> Order Fulfillment -> Payment -> Analytics & EOD Audit Generation.

## 2. Technology Stack
- **Frontend**: React (SPAs), Vite, TailwindCSS.
- **Backend**: Fastify (Node.js executed via `tsx`).
- **Database**: SQLite (MVP), Prisma ORM.
- **Authentication**: NextAuth (Auth.js) with JWT session strategy.
- **Testing**: Vitest (`@vitest/coverage-v8`).
- **Infrastructure**: `pnpm` Workspaces (Monorepo).

## 3. Monorepo Structure
```text
.
├── apps/
│   ├── api/                 # Fastify backend (Port 3001)
│   ├── customer-web/        # Mobile-first diner app (Port 5173)
│   ├── restaurant-admin/    # Kitchen/Manager dashboard (Port 5174)
│   └── platform-admin/      # Super-admin onboarding dashboard (Port 5175)
├── packages/
│   ├── db/                  # Prisma schema and generated client
│   ├── shared-types/        # TypeScript interfaces for API contracts
│   ├── shared-validation/   # Zod validation schemas
│   └── shared-config/       # Base ESLint/TS configurations
└── .ai/                     # AI Brain directory (Constitution, Tasks, Decisions)
```

## 4. Architecture Overview
- **High-level System**: Three distinct React Single Page Applications communicating with a centralized Fastify REST API. The API is the exclusive boundary interacting with the database.
- **Request Flow**: React SPA -> Fetch API -> Fastify HTTP Adapter -> Hexagonal Use Case -> Prisma Secondary Adapter -> SQLite.
- **Authentication Flow**: Handled via Auth.js `/api/auth/*` routes. SPAs use `credentials: 'include'` and manually intercept `302/opaqueredirect` responses to prevent native browser redirects from crashing frontend SPA JSON parsing.
- **Data Flow**: Kitchen applications rely on 5-second interval HTTP polling to fetch active orders from the API to maintain a decoupled and stateless WebSocket-free MVP.

## 5. Domain Model
- **Core Entities**: 
  - `Tenant` -> `Restaurant` -> `Table`.
  - `MenuCategory` -> `MenuItem`.
  - `Session` (a unique customer seating) -> `Order` (a kitchen ticket) -> `OrderItem` (individual dishes).
- **Key Invariants**:
  - Only one `ACTIVE` Session per Table is allowed simultaneously.
  - Financial line items and SLA timestamps are snapshotted on creation to prevent historical mutation if menu prices change.
  - Orders traverse a strict status machine: `RECEIVED` -> `PREPARING` -> `READY` -> `SERVED`.

## 6. Database Summary
- **Multi-tenancy Strategy**: Single database. Data is strictly isolated using a `tenantId` field on almost all core entities (Restaurant, Session, Order, Payment). Global metrics utilize denormalized `tenantId` indexes.
- **Primary Relationships**: Foreign keys enforce the hierarchy of `Tenant` -> `Restaurant` -> `Session/Table`. 
- **Data Retention**: Soft deletes are strictly enforced (`isActive: Boolean`, `deletedAt: DateTime?`). No hard deletes are permitted.

## 7. API Surface
- **Customer Flow**: `/table/:qrCode` (Menu fetching), `/table/:qrCode/order`, `/table/:qrCode/pay`
- **Kitchen Dashboard**: `/kitchen/orders` (GET all active, PATCH status updates)
- **Menu Management**: `/restaurant/:id/categories`, `/restaurant/:id/items`
- **Analytics & Reporting**: `/api/v1/restaurants/:id/metrics/daily`, `/api/v1/restaurants/:id/audit/eod` (JSON & CSV export)
- **Platform Admin**: `/admin/restaurants` (Tenant provisioning)

## 8. Frontend Architecture
- **Routing**: Minimalist state-based routing or lightweight React Router depending on the app.
- **State Management**: React Context API (`AuthContext`) for global auth state; localized component state for UI.
- **Data Fetching Strategy**: Native `fetch` with manual error handling. Heavy use of interval polling for real-time dashboards.
- **Component Organization**: Mobile-first design. CSS uses `flex` columns by default, wrapping for tablet/desktop (`flexWrap`, `flex: '1 1 300px'`).

## 9. Backend Architecture
- **Hexagonal Architecture (Ports and Adapters)**:
  - **Core**: Contains pure business logic (`core/use-cases/`) and outbound interfaces (`core/ports/`). No Fastify/Prisma imports.
  - **Primary Adapters**: HTTP Fastify routes (`adapters/primary/http/`). Responsible for Zod validation and calling Use Cases.
  - **Secondary Adapters**: Prisma database repositories and CSV generators (`adapters/secondary/`).
- **Safety**: Every Fastify route must be wrapped in `try/catch` to prevent process crashing on unhandled promise rejections.

## 10. Testing Strategy
- **Unit Testing**: Vitest used for isolating pure business logic in Hexagonal Use Cases.
- **Integration Testing**: Supertest utilized to hit Fastify endpoints with an in-memory or localized SQLite test DB.
- **Coverage**: Strict mandate (Rule 22) dictates that no core business logic or new use cases can be merged without accompanying unit tests.

## 11. Coding Standards
- **TypeScript Rules**: Version strictly pinned to `^5.2.2` globally. 
- **Validation**: All incoming POST/PATCH requests must be parsed by a Zod schema from `shared-validation` before database interactions.
- **Error Handling**: Descriptive error strings returned as `{ error: 'Message' }`. Fastify instance logs the stack trace internally.
- **Currency**: Financial data is handled exclusively in Rupees (₹) and stored as `Float`.

## 12. Current Development Status
- **Completed**: Monorepo configuration, Database schema, Core Ordering APIs, Mobile Customer Web App, Kitchen Kanban Dashboard, Platform Admin Dashboard, Analytics Sprint (Daily Metrics & EOD Audits).
- **In-progress**: Multi-tenant Access Controls & Authorization (RBAC).
- **Planned**: Mobile layout refinements, production staging, and deployment pipeline configuration.

## 13. Known Technical Debt
- **SQLite Limitations**: SLA metrics and Occupancy calculations are done in-memory via Node.js because SQLite lacks advanced date-diff aggregation across tables.
- **Kitchen Updates**: Relying on 5-second polling rather than Server-Sent Events (SSE) or WebSockets. Accepted MVP tradeoff to simplify infrastructure.
- **Payments**: The checkout flow is a mocked terminal integration that finalizes the session immediately upon button click.

## 14. AI Development Rules
- **Rule 1 (Ingestion)**: Must read the `.ai/` brain files before coding to prevent context rot.
- **Rule 3 (Decisions)**: `.ai/DECISIONS.md` is append-only. Never overwrite it.
- **Rule 17 (Hexagonal)**: Never import Prisma inside a Fastify HTTP handler. Route -> Use Case -> Repository.
- **Rule 18 (No DevOps configs)**: No standalone Dockerfiles or Vercel configs. Deployment rules belong in READMEs.
- **Rule 19 (Soft Deletes)**: Never invoke `prisma.model.delete()`. 

## 15. File Index
- `.ai/AI_RULES.md` & `.ai/AGENTS.md` - The strict constitutional rules governing AI behavior.
- `packages/db/prisma/schema.prisma` - The single source of truth for the data model.
- `apps/api/src/index.ts` - Backend bootstrap, DI container, and complete route catalog.
- `packages/shared-types/src/index.ts` - Shared contracts ensuring API and UI type parity.
- `apps/api/src/core/use-cases/AppUseCases.ts` - The primary entry point for core MVP business logic execution.

