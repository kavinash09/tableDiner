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
