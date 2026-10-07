# DECISIONS LOG

### 2026-10-08: Monorepo Setup (Chapter 2)
- **Tooling**: Standardized on `pnpm-workspace.yaml` grouping `apps/*` and `packages/*`.
- **Packages**: Initialized `@tablediner/*` namespaces for all internal dependencies to ensure explicit internal linking (e.g., `workspace:*`).
- **Base Config**: Added a unified `tsconfig.base.json` at the root for consistent strict typing across the monorepo.

### 2026-10-08: Data Foundations (Chapter 1)
- **Schema Expansion**: Added `MenuCategory` to organize `MenuItem`s. Added `OrderItem` to handle quantities. Added `qrCode` token to `Table`.
- **Process**: Established `docs/IMPLEMENTATION_MAP.md` as the blueprint.
- **Agent Guardrails**: Instituted the "State Checkpoint Protocol" to ensure `.ai` files are perfectly maintained via `AGENTS.md`.

### Initial Setup Decisions
- **Architecture**: Monorepo utilizing `pnpm workspaces`.
- **Backend**: Fastify API.
- **Frontend**: React.
- **Database**: SQLite for pilot phase. Prisma as ORM and ultimate source of truth.
- **Business Logic**: One active `Session` per table at a time. A `Payment` officially closes a session.
