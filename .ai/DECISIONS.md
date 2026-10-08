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

### 2026-10-08: Project Hygiene Sprint (Post-Scrutiny Fix)
- **Context**: Heavy scrutiny identified 13 gaps that would cause context rot and bugs at scale. All critical and high-priority items were fixed in one session.
- **ARCHITECTURE.md**: Completely rewritten to include port registry, full 9-route API catalog, shared package stub status, and data flow diagram. Was previously empty since Chapter 1.
- **RETRIEVAL_GUIDE.md**: Added mandatory Phase 1.5 Sanity Check — agents must now validate brain files against real code before writing anything.
- **AGENTS.md**: Rewritten from scratch as a 16-rule comprehensive AI development constitution encoding all lessons learned. Includes anti-patterns, code examples, and a quick reference card.
- **API error handling**: Added `try/catch` to all 9 route handlers. Previously, any Prisma failure would crash the Fastify process silently.
- **VITE_API_URL**: Removed 8 hardcoded `localhost:3001` instances across 3 apps. All frontends now use `import.meta.env.VITE_API_URL` with `.env.local` fallback.
- **tsx over ts-node**: Fixed `apps/api` and `packages/db` dev scripts from `ts-node` (broken) to `tsx` (works). This was a documented bug that was never committed back to the scripts.
- **TypeScript version**: Fixed `packages/db` from pinning broken `^7.0.2` to `^5.2.2`, matching the rest of the monorepo.
- **Root README.md**: Updated from "Chapter 1 complete" to reflect Chapter 6 complete state. Includes port table and proper getting-started instructions.
- **docs/DOMAIN_MODEL.md**: Created to fix the broken README link. `packages/db/ERD.md` had a circular reference ("See DOMAIN_MODEL.md") pointing to a nonexistent file.
- **CURRENT_TASK.md**: Replaced done-state retrospective with forward-looking task queue with remaining medium-term items.

### 2026-10-08: Medium-Term Architecture Fulfillment (Post-Scrutiny Fix)
- **Decision**: Populated `packages/shared-types/src/index.ts` with explicit TypeScript interfaces mapping all Prisma models and API response payloads.
- **Why**: The frontend applications were relying on `any` types and undocumented assumptions about the API shape, leading to brittleness and potential runtime errors.
- **Decision**: Populated `packages/shared-validation/src/index.ts` with Zod schemas for all API POST/PATCH inputs. Refactored `apps/api/src/index.ts` to use `safeParse` on these schemas.
- **Why**: Blind type assertions (`request.body as ...`) on the backend offered zero runtime safety. Invalid inputs would previously be sent directly to the database, potentially causing crashes or corruption.
- **Decision**: Refactored all three React apps (`customer-web`, `restaurant-admin`, `platform-admin`) to use the new shared types instead of `any`.
- **Why**: Enforces end-to-end type safety between the backend and frontends as mandated by the project standards.

### 2026-10-08: Design System & Tailwind CSS (Chapter 7)
- **Decision**: Defined a modern, high-contrast, minimalist design system (Zinc/Emerald palette, Inter font, 16px/12px border radii).
- **Decision**: Introduced Tailwind CSS to `apps/customer-web`, `apps/restaurant-admin`, and `apps/platform-admin`.
- **Why**: The user requested a consistent, cutting-edge UI/UX. While inline styles worked for the rough MVP, scaling a consistent design system requires a robust CSS framework. Tailwind was explicitly approved by the user per Rule 12.
### 2026-10-08: Real-World Friction Fixes (Chapter 7)
- **Decision**: Added Cart Modal with quantity/remove controls, backward transitions in Kitchen Dashboard, and `notes` field to `OrderItem`.
- **Why**: An end-to-end simulation revealed 3 severe UX issues: no cart editing (users couldn't undo an accidental add), one-way kitchen flows (couldn't undo a status change), and lack of dietary note support.
- **Trade-off accepted**: Added complexity to the `OrderItem` schema and `Customer Web` UI, but essential for real-world viability. User explicitly approved the schema change.
### 2026-10-08: Aesthetic Overhaul (Chapter 7)
- **Decision**: Redesigned the color schema and typography to match a clean editorial layout with a deep forest green palette (`#14351A`).
- **Why**: The user provided a specific creative brief requesting an editorial, casual but refined cafe feeling featuring `EB Garamond` for headings, `Barlow` for functional information, and a printed menu clipboard aesthetic with bilingual (Polish/English) elements.
- **Implementation**: 
  - Overhauled `index.css` across all frontends to map the Tailwind CSS variables to the Forest Green palette.
  - Rebuilt the layout in `customer-web/src/App.tsx` using a custom "clipboard and paper" CSS composition with delicate borders.
  - Switched fonts by importing from Google Fonts.
### 2026-10-08: Admin Customization & QR Generation (Chapter 7)
- **Decision**: Added `theme` and `qrTemplate` fields to the `Restaurant` database model, and implemented a Settings tab in `Restaurant Admin`.
- **Why**: The user requested that restaurant admins have the ability to control their theme and generate their own QR codes based on preconfigured templates.
- **Implementation**:
  - `qrcode.react` was introduced to render printable SVGs.
  - The `Customer Web` app now dynamically overrides CSS variables (e.g. `--color-wood`, `--color-paper`) via inline styles based on the restaurant's active `theme`.

### 2026-10-08: Menu & Banner Image Support (Chapter 7)
- **Decision**: Added a "Menu Manager" tab in `Restaurant Admin` to upload menu item pictures, and a banner upload field in the Settings tab.
- **Why**: The user requested that restaurant admins be able to upload images for the banner and individual menu items.
- **Implementation**: 
  - The API was extended to handle multipart uploads (local storage in dev, S3 in prod based on config).
  - The `TableDetailsResponse` in `shared-types` was updated to include the `bannerUrl` and `theme` for the customer UI to consume.
  - The `Customer Web` app was updated to render the `bannerUrl` in the header, and `imageUrl` next to the item name and price if an image exists.

### 2026-10-08: Refactored API to Hexagonal Architecture (Chapter 7)
- **Decision**: Refactored `apps/api` to use a Hexagonal Architecture (Ports and Adapters) pattern, separating routing, business logic, and database access. Added RULE 17 to `.ai/AGENTS.md` to enforce this pattern moving forward.
- **Why**: The user explicitly requested to make the components pluggable and loosely coupled so that different implementations could be swapped in the future without changing the business logic.
- **Implementation**:
  - `core/ports/Repositories.ts`: Created interfaces representing the database operations needed by the application.
  - `adapters/secondary/db/PrismaRepositories.ts`: Implemented the repository interfaces using Prisma. This is the only place where Prisma is imported.
  - `core/use-cases/AppUseCases.ts`: Encapsulated all business logic within use cases that depend only on the repository interfaces.
  - `index.ts`: Updated Fastify routes to instantiate the repositories, inject them into the use cases, and route requests to the use cases.

### 2026-10-08: Menu Items CRUD Operations (Chapter 7)
- **Decision**: Added full CRUD operations (Create, Update, Delete) for Menu Categories and Menu Items to the API and Restaurant Admin dashboard.
- **Why**: The user requested that restaurant admins be able to edit food item names and manage other CRUD settings directly from the UI.
- **Implementation**:
  - `shared-validation`: Added Zod schemas for `CreateCategory`, `CreateMenuItem`, and `UpdateMenuItem`.
  - `apps/api`: Extended `Repositories`, `PrismaRepositories`, and `AppUseCases` to handle creation, updating, and deletion of both categories and items. Exposed these via 5 new Fastify routes.
  - `apps/restaurant-admin`: Created a dedicated `<MenuManager />` component to handle category/item creation, inline editing, and deletion with confirmation prompts, replacing the static list.

### 2026-10-08T23:42:00: Added created/updated timestamps to all Database Models
- **Decision**: Added `createdAt` and `updatedAt` to every model in the Prisma schema.
- **Why**: An MVP oversight; required for any basic tracking of data creation over time.

### 2026-10-08T23:46:00: Selected Auth.js (NextAuth) for Authentication
- **Decision**: Added NextAuth (`@auth/core` and `@auth/prisma-adapter`) using JWT sessions directly into the Fastify backend on the `/api/auth/*` route, rather than switching to Next.js.
- **Why**: The user requested NextAuth. Because our stack is decoupled (Vite + Fastify), building the API adapter via `@auth/core` allows us to gain NextAuth's features while maintaining the existing React SPA architecture.

### 2026-10-08T23:52:00: Hardened Database Schema for Production Metrics
- **Decision**: Added soft-deletes (`isActive`, `deletedAt`), specific timeline metrics (`acceptedAt`, `readyAt`, `servedAt` on Orders), onboarding status for Tenants, and price snapshots (`unitPrice` on OrderItem).
- **Why**: Deleting Tenants or updating MenuItem prices previously destroyed global metrics. A production application requires historical auditing and SLA tracking.

### 2026-10-08T23:52:30: Introduced Strict OOP Domain Entities
- **Decision**: Created Rich Domain Entities (`TableSession.ts`, `Order.ts`) in the core domain layer, moving away from manipulating raw JSON/Prisma DTOs in the UseCases layer.
- **Why**: The Hexagonal Architecture previously implemented had an "Anaemic Domain Model". Business logic (like checking payment totals or advancing order states) must be encapsulated within the Domain Entities themselves for true OOP adherence.

### 2026-10-09T00:03:00: Schema Architecture Metrics & Analysis Fixes
- **Decision**: Added Subscriptions and TenantAuditLogs models, expanded Session with financial breakdowns (subtotal, taxAmount, tipAmount, discountAmount) and `guestCount`, added `CANCELLED` tracking to Orders, and introduced Database Indexes across the schema.
- **Why**: The schema previously could not track real-world SaaS financial metrics (MRR), failed to provide ARPU (spend per head), couldn't calculate net revenue vs gross, and lacked an audit trail for Tenant lifecycle decommissioning.
- **Trade-off accepted**: Added complexity to the `Session` domain object (which will now have to manage these breakdowns), but necessary for MVP real-world reporting viability.

### 2026-10-09T00:06:00: Introduce BaseEntity for Domain Layer
- **Decision**: Created `BaseEntity.ts` and `ArchivableEntity.ts` inside `apps/api/src/core/domain/`. Refactored `Order` and `TableSession` to extend `BaseEntity` and include the newly added financial breakdown properties.
- **Why**: Pure OOP requires domain objects to track standard lifecycle properties (`createdAt`, `updatedAt`) natively. `ArchivableEntity` standardizes the soft-delete mechanism across all future domain classes.
- **Trade-off accepted**: Constructor signatures for Domain objects are now larger and require Prisma mappers to inject timestamp properties.

### 2026-10-09T00:19:00: Applied Analytics Spec v1 to Database
- **Decision**: Updated the Prisma Schema to fully support the Analytics Spec v1. Added `businessDayCutoffHour`, `businessDate`, and `tenantId` (denormalized) to operational models. Also added `refundedAmount`, `isVoided`, and reopened session auditing.
- **Why**: To support post-midnight reporting, retroactive refunds, and cross-tenant GMV aggregation without expensive joins.
- **Trade-off accepted**: Minor data duplication (denormalizing `tenantId` on Orders/Sessions) in exchange for massive read-performance gains on Platform Admin dashboards.

### 2026-10-09: Platform Admin Dashboard Layout
- **Decision**: Implemented a simple state-based tab switcher (`activeTab: 'tenants' | 'analytics'`) in `apps/platform-admin/src/App.tsx`.
- **Why**: Avoids introducing `react-router-dom` or other routing dependencies just for two views, keeping the MVP lightweight.
- **Trade-off accepted**: No deep linking to the analytics tab via URL.
- **Reversal trigger**: If we add more than 3-4 distinct sections to the platform admin, we should migrate to a proper router.

### 2026-10-09: Testing Framework Setup & Enforcement
- **Decision**: Added `vitest` to `apps/api` and enforced mandatory unit testing in `AI_RULES.md`.
- **Why**: The user noticed regressions (415 error on login) and explicitly required strict unit testing for verification purposes.
- **Trade-off accepted**: Slight increase in development time per feature, but massive increase in stability.
### 2026-10-09: EOD Audit Report Implementation
- **Decision**: Added `GetEODAuditReportUseCase` utilizing a manual CSV string generator (`CsvExportAdapter`) rather than importing a large CSV library.
- **Why**: Keeps the dependency footprint small and execution fast for a flat dataset. We handle simple escaping manually.
- **Trade-off accepted**: Complex nested data structures in the future might require a dedicated CSV library, but current EOD format is purely tabular.
- **Reversal trigger**: If we add multiple exports with complex nested data or need streaming CSVs, we should switch to `fast-csv`.

### 2026-10-09: Fix SPA Auth.js Redirect Issue in Admin Apps
- **Decision**: Used `redirect: 'manual'` in fetch calls to `callback/credentials` and manually handled `opaqueredirect` and `302` response statuses in `AuthContext.tsx`.
- **Why**: Auth.js returns a 302 redirect after successful login. Using standard fetch makes the browser follow the redirect automatically to the backend base URL (which might 404 or return HTML), breaking `res.json()`.
- **Trade-off accepted**: Manual status checking introduces slightly more verbose fetch logic, but correctly isolates backend auth redirects from frontend SPAs.
### 2026-10-08: Resolved Critical Architectural Audit Findings (Chapter X)
- **Decision**: Implemented `tenantId` and `businessDate` injection in `Session`, `Order`, and `Payment` creation. Fixed `Session` status to default to `OPEN`. Transitioned `deleteCategory` and `deleteItem` to use soft deletes (`deletedAt`). Refactored `getBill()` to calculate totals based on the historical `unitPrice` snapshot in `OrderItem`.
- **Why**: These were identified as CRITICAL and HIGH risk vulnerabilities in the system audit. The missing fields were breaking Analytics (which relies on `tenantId` and `businessDate`). The `ACTIVE` session status was invalid according to the Prisma schema. Hard deletes were violating AI Rule 19 and destroying historical data. Using live prices in `getBill()` instead of snapshots meant customers could be over/under-charged if prices changed during a session.
- **Trade-off accepted**: `getCurrentRestaurant()` is still temporarily used in the `kitchen/orders` route to supply `restaurantId` until full authentication guard injection is completed.
- **Reversal trigger**: Never reverse. Soft deletes and tenant-isolation are foundational invariants.

### 2026-10-09: Remediated Issue 1 - Session Closure Timestamps & Financial Snapshots (P0)
- **Decision**: Implemented atomic persistence of `closedAt`, `subtotal`, `taxAmount`, `tipAmount`, `discountAmount`, and `totalAmount` upon session checkout in `PrismaPaymentRepository.processCheckout`. Aligned `TableSession` domain entity status enum to `'OPEN' | 'CLOSED' | 'REOPENED' | 'FINALIZED'` and fixed `PrismaTableRepository.findByQrCode` to look up `OPEN` sessions.
- **Why**: `closedAt` was never being captured and financial totals remained at default `0.0`. This broke all downstream analytics (`occupancyPercent`, `avgTableTurnTimeMinutes`, `grossRevenue`, `netRevenue`, `avgTicketSize`, and platform GMV).
- **Trade-off accepted**: For MVP mock payments, tax, tip, and discount are set to 0.0 with full subtotal mapped to `totalAmount`.
- **Reversal trigger**: Never reverse. Immutable financial snapshotting on session close is an essential domain invariant.

### 2026-10-09: Remediated Issue 2 - Order Lifecycle Timestamps Persistence (P0)
- **Decision**: Implemented strict domain state machine validation and lifecycle timestamp persistence (`acceptedAt`, `readyAt`, `servedAt`, `cancelledAt`) in `PrismaOrderRepository.updateOrderStatus`. State skipping (e.g. `RECEIVED` -> `SERVED`) is prohibited, and terminal states (`SERVED`, `CANCELLED`, `REJECTED`) are strictly protected against invalid mutations.
- **Why**: Kitchen SLA metrics (`avgKitchenPrepTimeMinutes`, `avgServiceTimeMinutes`, `avgFulfillmentTimeMinutes`) previously returned 0.0 because timestamps were never captured upon status changes. Skipping states corrupted the operational SLA funnel.
- **Trade-off accepted**: Route returns HTTP 400 with a descriptive error message when invalid state transitions are attempted by clients.
- **Reversal trigger**: Never reverse. Strict state machines are vital for SLA metrics and kitchen workflow integrity.

### 2026-10-09: Remediated Issue 4 - Historical Session Data Backfill (P0)
- **Decision**: Implemented and executed an idempotent, non-destructive backfill procedure in `packages/db/scripts/backfill-sessions.ts`. It safely recovers missing `closedAt` timestamps from associated `Payment.createdAt` records and recovers `subtotal` and `totalAmount` from unvoided `OrderItem` snapshots.
- **Why**: Protects historical analytics, occupancy rates, and financial reports from corruption caused by legacy records created prior to Issue 1's fix.
- **Trade-off accepted**: Only applies to sessions where `closedAt` is null or `totalAmount` is 0; healthy sessions are strictly untouched.
- **Reversal trigger**: Never reverse. Historical consistency is a permanent guarantee.
### 2026-10-09: Remediated Issue 3 - Analytics Query In-Memory Performance Optimization (P1)
- **Decision**: Replaced all `findMany` queries and JavaScript in-memory array iteration loops in `PrismaRestaurantAnalyticsRepository.getUtilizationMetrics` and `getSlaMetrics` with database-level SQL aggregations using Prisma's `$queryRaw`.
- **Why**: Previously, calculating `avgTableTurnTimeMinutes`, `occupancyPercent`, and SLA stage metrics (`avgKitchenPrepTimeMinutes`, `avgServiceTimeMinutes`, `avgFulfillmentTimeMinutes`) fetched full table and order records into Node.js heap memory, instantiating `Date` objects and looping in JavaScript. At restaurant scale (thousands of sessions/orders per day), this introduces massive memory allocation spikes, GC pressure, and risks Node.js heap exhaustion (OOM).
- **Trade-off accepted**: Raw SQL queries leverage SQLite's native integer timestamp difference calculations directly in C/database layer while keeping the exact repository port interface and return signatures intact.
- **Reversal trigger**: If migrating to PostgreSQL in future production, syntax can adapt to native date/interval functions like `EXTRACT(EPOCH FROM (closedAt - createdAt)) / 60.0`.
### 2026-10-09: Designed Event-Driven Analytics Platform & Semantic Query Engine
- **Decision**: Designed the complete architectural evolution of TableDiner from a report-centric, OLTP-coupled model to an asynchronous, event-driven analytics platform with an append-only Event Store (`AnalyticsEvent`), Transactional Outbox pattern, CQRS materialized read projections, and a Universal Semantic Query DSL.
- **Why**: Currently, analytics queries run synchronously against live operational database tables (`Session`, `Order`, `Payment`). As dining transaction volume scales, this creates lock contention, memory bloat, and operational latency spikes. Furthermore, every new metric or custom report currently requires schema changes and backend code deployments. Moving to an event-driven architecture decouples the operational core, guarantees historical immutability, achieves sub-5ms dashboard lookups, and enables self-serve dynamic analytics slicing.
- **Trade-off accepted**: Introduces an asynchronous event processing pipeline and materialized projection tables, adding eventual consistency (sub-second latency between operational checkout and projection update) instead of synchronous transactional reads.
- **Reversal trigger**: If operational transaction throughput remains under 50 transactions per day where raw SQL queries have zero performance overhead, the legacy queries can remain active via the backward-compatible fallback adapter.
### 2026-10-09: Adopted PostgreSQL Database Architecture (Docker Dev / Managed RDS Prod)
- **Decision**: Adopted PostgreSQL 16 as the standardized relational database across the platform, replacing SQLite. For local development, PostgreSQL runs in a Docker container with host volume mapping (`.postgres_data`). For production, managed PostgreSQL (AWS RDS PostgreSQL, Supabase, or Cloud SQL) will be utilized.
- **Why**: SQLite is inherently single-writer, creating severe lock contention risks during concurrent dining checkout writes and outbox event polling. PostgreSQL provides Multi-Version Concurrency Control (MVCC) with row-level locking, non-blocking `FOR UPDATE SKIP LOCKED` for outbox event workers, native binary `JSONB` for event payloads, and native interval arithmetic (`EXTRACT(EPOCH FROM ...)`). Adopting PostgreSQL locally via Docker ensures 100% SQL dialect and behavioral parity between development and production.
- **Trade-off accepted**: Requires Docker to run PostgreSQL locally during development. In accordance with Rule 18, all container deployment instructions are documented inline in `README.md` without standalone deployment files.
- **Reversal trigger**: Never reverse. Full ACID concurrency and native JSONB are mandatory prerequisites for multi-tenant SaaS scaling.
