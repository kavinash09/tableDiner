# Maintenance Checklist — TableDiner Monorepo

> Mandatory self-maintenance protocol for AI agents and human contributors.  
> Run the relevant section for every change. Run **State Checkpoint** at the end of every session without exception.

---

## When Adding a New API Route

- [ ] Declare Zod validation schema in `shared-validation/src/index.ts` (not inline)
- [ ] Register route in the appropriate `adapters/primary/http/` file
- [ ] Implement (or wire) the corresponding use case in `core/use-cases/`
- [ ] Use case imports only from `core/ports/`, `core/domain/`, `@tablediner/shared-types`
- [ ] Route handler has `try/catch` with `app.log.error(err)` in catch
- [ ] Validation failure returns `400 { error: zodError.errors[0].message }`
- [ ] Write unit test for the use case (mock the port, not Prisma)
- [ ] Add route entry to `.ai/knowledge/04-api-catalog.md` (method, path, request shape, response shape)
- [ ] If the route introduces a new architectural pattern → append entry to `.ai/DECISIONS.md`
- [ ] Run `pnpm test` — all tests pass before committing

---

## When Adding a New Prisma Model

- [ ] Add model to `schema.prisma` in the `@tablediner/db` package
- [ ] Add soft-delete fields if entity is archivable: `isActive Boolean @default(true)`, `deletedAt DateTime?`
- [ ] Add `tenantId` / `restaurantId` if the model is operational data (Session, Order, OrderItem, Payment pattern)
- [ ] Define index strategy: unique constraints, composite indexes for tenant-scoped queries
- [ ] Run `prisma migrate dev --name <descriptive-name>`
- [ ] Export a matching TypeScript interface/type in `@tablediner/shared-types`
- [ ] Update `seed.ts` if the new model requires baseline data
- [ ] Update the relevant feature pack database file: `.ai/features/<feature>/database.md`
- [ ] Update `.ai/knowledge/03-database-model.md` with model description and field table
- [ ] Append structural decision to `.ai/DECISIONS.md` if schema shape is non-trivial

---

## When Modifying a Use Case

- [ ] Update the use case file in `core/use-cases/`
- [ ] Verify imports still comply with layer rules (no Prisma, no fastify)
- [ ] Update or add unit test — test must mock the port interface, not the DB adapter
- [ ] Update `.ai/knowledge/05-use-case-catalog.md` (actor, trigger, steps, ports used)
- [ ] Update relevant feature pack: `.ai/features/<feature>/use-cases.md`
- [ ] If method signature changes affect port interfaces → update `core/ports/` and `@tablediner/shared-types`
- [ ] If the change alters observable API behavior → update `.ai/knowledge/04-api-catalog.md`

---

## When Fixing a Bug

- [ ] Document root cause in `.ai/knowledge/knowledge-audit.md` (symptom → root cause → fix)
- [ ] Append entry to `.ai/DECISIONS.md`: date, bug description, root cause, fix chosen, trade-offs
- [ ] Add regression test that reproduces the bug before the fix
- [ ] Confirm regression test fails on unfixed code, passes after fix
- [ ] Update relevant feature pack file if the bug affects documented behavior

---

## When Adding a New Feature / Bounded Context

- [ ] Create `.ai/features/<newfeature>/` directory with the following 5 files:
  - `overview.md` — purpose, actors, bounded context boundary
  - `use-cases.md` — all use cases with actor/trigger/steps/ports
  - `api.md` — routes owned by this feature
  - `database.md` — models, fields, indexes, relationships
  - `rules.md` — domain invariants and business rules specific to this feature
- [ ] Register feature in `.ai/context-manifest.md`
- [ ] Add all new use cases to `.ai/knowledge/05-use-case-catalog.md`
- [ ] Add all new routes to `.ai/knowledge/04-api-catalog.md`
- [ ] Add all new tests to `.ai/knowledge/06-test-catalog.md`
- [ ] Update `PROJECT_STATE.md`: add feature to phase/module table with status `IN PROGRESS`
- [ ] Append architectural decision to `.ai/DECISIONS.md` if new bounded context introduces new patterns

---

## When Changing Authentication

- [ ] Update `.ai/knowledge/09-auth-model.md` (token type, claims, expiry, middleware)
- [ ] Update `.ai/features/auth/*.md` (all relevant files in auth feature pack)
- [ ] Update frontend `AuthContext` if token shape or claims change
- [ ] Verify CORS configuration still covers all clients
- [ ] Test full login → token → protected-route flow end-to-end
- [ ] Confirm `AUTH_SECRET` is still read from environment, not hardcoded
- [ ] Append entry to `.ai/DECISIONS.md` with rationale for auth change

---

## When Changing Database Schema

- [ ] Edit `schema.prisma` in `@tablediner/db`
- [ ] Run `prisma migrate dev --name <descriptive-name>`
- [ ] Update matching TypeScript type/interface in `@tablediner/shared-types`
- [ ] Update `.ai/knowledge/03-database-model.md`
- [ ] Update relevant `.ai/features/<feature>/database.md`
- [ ] Update `seed.ts` if baseline data is affected
- [ ] Append entry to `.ai/DECISIONS.md` if the change is structural (new model, dropped column, index change)

---

## Mandatory State Checkpoint — Run at End of Every Session

> [!IMPORTANT]
> This checklist is atomic. Every item must be completed or explicitly marked as N/A with a reason before the session ends.

- [ ] **1. DECISIONS.md** — append entry with: date · what changed · why · trade-offs considered · reversal trigger (use `Append: true` — never overwrite)
- [ ] **2. ARCHITECTURE.md** — routes and port interfaces updated to reflect actual code
- [ ] **3. `.ai/knowledge/04-api-catalog.md`** — updated if any routes were added, changed, or removed
- [ ] **4. `.ai/knowledge/05-use-case-catalog.md`** — updated if any use cases were added or modified
- [ ] **5. `.ai/knowledge/06-test-catalog.md`** — updated with any new or modified tests, including file path and coverage intent
- [ ] **6. `PROJECT_STATE.md`** — phase and module status reflect current reality
- [ ] **7. `CURRENT_TASK.md`** — updated to point to the next task (not the completed one)
- [ ] **8. Relevant `.ai/features/*/` files** — any feature pack files whose domain was touched are updated

---

## Drift Prevention

- If any brain file (`.ai/knowledge/*.md`, `.ai/features/**/*.md`, `PROJECT_STATE.md`) was **not updated in the last session** despite the session touching its domain → mark it **STALE** in `context-manifest.md`
- **Sanity check at session start** (per AGENTS.md Rule 2): compare actual routes in `index.ts` against `.ai/knowledge/04-api-catalog.md` — if they diverge, update the catalog **before writing any new code**
- If the catalog and code disagree, the **code is the source of truth** — update docs, not code
