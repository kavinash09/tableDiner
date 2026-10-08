# Agent Rules for TableDiner

## The Complete AI Development Constitution

These rules are injected into every conversation. They encode every hard lesson learned during this project's development. Violating these rules degrades AI effectiveness and causes context rot. There are no exceptions.

---

## 🧠 RULE 1: Read the Brain Before Touching Code

**MANDATORY**: Before writing a single line of code, read these files **in order**:

1. `.ai/PROJECT_CONTEXT.md` — business goal and what is explicitly OUT of scope
2. `.ai/PROJECT_STATE.md` — what is built vs what is pending
3. `.ai/CURRENT_TASK.md` — the immediate next objective with sub-steps
4. `.ai/ARCHITECTURE.md` — port map, API route catalog, and shared package status
5. `.ai/DECISIONS.md` — *why* choices were made (prevents re-litigating)
6. `.ai/AI_RULES.md` — the strict constitution

Then execute the **Phase 1.5 Sanity Check** (see Rule 2) before proceeding.

> ❌ **NEVER** skip ingestion to "save time." Every skipped read costs more time in corrections.

---

## 🔬 RULE 2: Sanity-Check the Brain Files Against Reality

**AI brain files drift. Always verify before trusting them.**

Execute this checklist at the start of every task:

```
[ ] Scan apps/api/src/index.ts — do the actual routes match ARCHITECTURE.md's route table?
    → If stale: update ARCHITECTURE.md FIRST, then proceed.

[ ] Check packages/shared-types/src/index.ts — does it still say "export {}"?
    → If yes: do NOT generate any imports from it. State this explicitly in your plan.

[ ] Check packages/shared-validation/src/index.ts — does it still say "export {}"?
    → Same rule as above.

[ ] Check apps/api/package.json "dev" script — does it use "tsx", not "ts-node"?
    → If it says ts-node: fix it before declaring success on any task.
```

> This check takes 30 seconds and prevents hours of hallucinated architecture.

---

## 📝 RULE 3: DECISIONS.md Is a Sacred Append-Only Log

**The single most important data hygiene rule in this project.**

- ✅ Use `Append: true` when writing to `DECISIONS.md`. Always.
- ✅ Each entry MUST include the **date**, the **what**, and critically the **why**.
- ✅ Document reversals and mistakes — they are the most valuable entries.
- ❌ NEVER use `Overwrite: true` on `DECISIONS.md`. This deletes institutional memory.
- ❌ NEVER replace the entire file contents. Use append-only or `replace_file_content` targeting specific lines.

**Good entry format:**

```markdown
### 2026-10-08: Why We Chose Polling Over WebSockets (Chapter 4)
- **Decision**: Used 5-second HTTP polling for kitchen dashboard.
- **Why**: WebSockets add operational complexity (sticky sessions, infra config). MVP doesn't need <5s latency.
- **Trade-off accepted**: Orders may show with up to 5s delay.
- **Reversal trigger**: If kitchen staff complain about missed orders, upgrade to SSE or WS.
```

**Bad entry (do not do this):**

```markdown
### Chapter 4
- Used polling.
```

---

## 🏗️ RULE 4: Update ARCHITECTURE.md Every Time a Route or Port Changes

`ARCHITECTURE.md` is the single source of truth for:

- **Port registry** (which app runs on which port)
- **API route catalog** (method, path, body, description)
- **Shared package status** (active vs stub)

After adding, removing, or modifying any API route or adding a new app:

1. Open `ARCHITECTURE.md`
2. Update the relevant table
3. Commit the change in the same step — never defer this

> A stale `ARCHITECTURE.md` is worse than no architecture doc. It actively misleads every future agent.

---

## 📋 RULE 5: CURRENT_TASK.md Must Always Point Forward

`CURRENT_TASK.md` is a **live forward-looking queue**, not a retrospective.

**Rules:**

- ✅ After completing a task, immediately replace the content with the *next* task and its sub-steps.
- ✅ Use checkboxes `[ ]` for pending, `[x]` for done.
- ✅ Include a "Next Up After This" section so the agent always has a horizon.
- ❌ NEVER leave it in a "done-state" with all boxes checked and no next objective.
- ❌ NEVER leave it empty.

**If all chapters are done**, write:

```markdown
**Active Objective**: Post-MVP Polish Sprint
- [ ] Identify top 3 real-world friction points from testing
- [ ] ...
```

---

## 🔌 RULE 6: Never Hardcode localhost URLs

All frontend apps (React/Vite) must use the `VITE_API_URL` environment variable:

```typescript
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
```

Each app MUST have a `.env.local` file:

```env
VITE_API_URL=http://localhost:3001
```

> **Why**: Hardcoded `localhost` breaks staging, production, and any machine with a different port. The env var makes deployment a config change, not a code change.

---

## 🛡️ RULE 7: Every Fastify Route Handler Must Have try/catch

```typescript
// ✅ CORRECT
app.get('/some/route', async (request, reply) => {
  try {
    const result = await prisma.something.findMany(...);
    return result;
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Descriptive message for the client.' });
  }
});

// ❌ WRONG — unhandled Prisma error crashes the process
app.get('/some/route', async (request, reply) => {
  const result = await prisma.something.findMany(...);
  return result;
});
```

The Fastify process crashing means ALL tables lose ordering ability simultaneously. This is not acceptable even in MVP.

---

## 📦 RULE 8: Shared Packages Are Contracts — Treat Them As Such

The packages `shared-types` and `shared-validation` exist to prevent API-UI drift.

**Before using them:**

- Verify they are NOT `export {}` stubs (run the Sanity Check from Rule 2)
- If still stubs, populate them before generating code that imports from them

**When populating `shared-types`:**

- Define TypeScript interfaces matching EVERY API response shape
- Export them from `src/index.ts`
- Then update imports in `apps/api` and all frontend apps to use them

**When populating `shared-validation`:**

- Write Zod schemas for every POST/PATCH request body
- Use `schema.parse()` at the top of the route handler — before any DB call
- Log the addition in `DECISIONS.md`

---

## 📐 RULE 9: TypeScript Versions Must Be Consistent

The entire monorepo MUST use **`typescript@^5.2.2`** (or the same pinned version).

- `packages/db` must NOT pin a different version
- `ts-node` does NOT work reliably — use **`tsx`** for all TS script execution
- Seed scripts: `npx tsx seed.ts`
- API dev: `tsx --watch src/index.ts`

> **Why this matters**: A mismatched TypeScript version caused a complete dev environment breakdown in this project. Don't repeat it.

---

## 📱 RULE 10: Mobile-First UI — No Exceptions

All frontend apps must be designed mobile-first:

```css
/* ✅ Mobile-first: default is single column */
.container { display: flex; flex-direction: column; }

/* ✅ Expand for tablets/desktop */
@media (min-width: 768px) {
  .container { flex-direction: row; flex-wrap: wrap; }
}
```

For inline styles (current pattern):

```tsx
// ✅ Use flexWrap: 'wrap' with flex: '1 1 300px' on children
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
  <div style={{ flex: '1 1 300px' }}>...</div>
</div>
```

> Applies to: `customer-web`, `restaurant-admin`, `platform-admin`. Customer web is critical — diners use phones.

---

## 💰 RULE 11: Currency Is Always Rupees (₹)

- Display: `₹${amount.toFixed(2)}`
- Storage: Prisma `Float` — store raw number (e.g., `149.99`)
- No dollar signs, no "INR" text — always `₹` symbol
- Apply to: menu prices, cart totals, bill totals, payment amounts

---

## 🏛️ RULE 12: No Architecture Changes Without Explicit User Approval

Before introducing:

- A new npm dependency
- A new app or package
- A new database model or field
- A switch in framework or tooling pattern

...you MUST stop, explain the rationale, and get explicit user approval. If the user says "focus on MVP", that is a direct instruction to not introduce new architecture.

> **The Platform Admin before Payments mistake**: Chapter 6 (Platform Admin) was built before Chapter 5 (Payments) was complete because the agent failed to respect MVP scope. The `PROJECT_CONTEXT.md` and `IMPLEMENTATION_MAP.md` are the compass — follow them.

---

## 💾 RULE 13: State Checkpoint Is Mandatory at Task End

Before declaring any task complete, run through this checklist:

```
[ ] DECISIONS.md  — New decision made? APPEND with date, what, and why.
[ ] ARCHITECTURE.md — New route or port? Update the relevant table.
[ ] PROJECT_STATE.md — Module complete? Check the box. New phase? Update label.
[ ] CURRENT_TASK.md — Task done? Replace with the NEXT forward-looking task.
[ ] App README.md — Startup commands or env vars changed? Update the relevant app README.
[ ] Root README.md — Overall project status changed? Update "Current Status".
```

> Skipping this checkpoint is the #1 cause of context rot. Future sessions inherit stale state and waste time reconstructing what you already knew.

---

## 📚 RULE 14: Every App and Package Must Have a README.md

Each `apps/*` and `packages/*` directory MUST have a `README.md` covering:

- What it does (1-2 sentences)
- How to run it in development
- Required environment variables
- Key files to know about

Update the README whenever deployment, env vars, or startup commands change.

---

## 🌿 RULE 15: Environment & Git Hygiene

Maintain these files and never let them drift:

| File                      | Purpose               | Rule                                                                         |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `.nvmrc`                | Locks Node.js version | Must be`18` (current LTS used in this project)                             |
| `.gitignore`            | Prevents junk in VCS  | Must include:`node_modules/`, `dist/`, `.env`, `*.db`, `.DS_Store` |
| `.vscode/settings.json` | Editor consistency    | Must exist; include formatter settings                                       |
| `pnpm-workspace.yaml`   | Workspace definition  | Must list all`apps/*` and `packages/*`                                   |

---

## 🚫 RULE 16: Never Make Silent Assumptions

If a requirement is ambiguous:

- **STOP. Ask the user.**
- Do not guess business logic.
- Do not implement "the obvious interpretation" without asking.

Examples of things that require explicit clarification:

- "Should this be per-restaurant or global?"
- "What should happen when a session is already closed?"
- "Should we validate the payment amount server-side?"

> Assumption-driven code is a hidden landmine. It works until it doesn't, and the failure is always at the worst possible moment.

---

## 📊 Quick Reference Card

| Concern                  | Pattern                                          |
| ------------------------ | ------------------------------------------------ |
| API dev server           | `tsx --watch src/index.ts`                     |
| Seed DB                  | `npx tsx seed.ts`                              |
| API URL in frontend      | `import.meta.env.VITE_API_URL`                 |
| Currency display         | `₹${amount.toFixed(2)}`                       |
| Route error handling     | `try {} catch (err) { reply.status(500) }`     |
| Append decisions         | `Append: true` — never `Overwrite: true`    |
| Check shared pkg is real | Look for`export {}` — if present, it's a stub |
| TypeScript version       | `^5.2.2` everywhere                            |
| Mobile layout            | `flexWrap: 'wrap'`, `flex: '1 1 300px'`      |
| New dependency           | Ask user first                                   |

---

## 🛑 RULE 17: Enforce Hexagonal Architecture (Ports and Adapters)

All backend code (`apps/api`) MUST strictly follow a Hexagonal Architecture.

**Rules:**

- ✅ **Core (Domain/Use Cases)**: Business logic lives here. It must NEVER import from `fastify`, `prisma`, or external APIs directly.
- ✅ **Ports**: Define TypeScript interfaces in the Core for outbound operations (e.g., `RestaurantRepository`).
- ✅ **Primary Adapters (Inbound)**: HTTP routes (Fastify) belong here. They parse input, call Use Cases, and format responses.
- ✅ **Secondary Adapters (Outbound)**: Implementations of Ports (e.g., `PrismaRestaurantRepository`) live here. This is the ONLY place where `prisma` is imported.
- ❌ **NEVER** write Prisma queries directly inside Fastify route handlers.

**Directory Structure:**

```
apps/api/src/
  core/
    ports/       # Interfaces (e.g. Database, S3)
    use-cases/   # Pure business logic
  adapters/
    primary/
      http/      # Fastify routes
    secondary/
      db/        # Prisma repository implementations
  index.ts       # Dependency injection & bootstrap
```

---

## 🚫 RULE 18: No Standalone Deployment Configuration Files

Do NOT create standalone deployment configuration files like `Dockerfile`, `.dockerignore`, or `vercel.json` anywhere in the repository.
All deployment instructions and configurations should be provided inline within the `README.md` file so the user can implement them manually if they choose to.

---

## 🏗️ RULE 19: Database Schema Hardening & Soft Deletes

All Prisma models MUST adhere to strict database hygiene and hardening rules to preserve historical data and metrics:

- Every model must include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- Archivable or state-changing entities MUST have `isActive Boolean @default(true)` and `deletedAt DateTime?`.
- **NO HARD DELETES**: Never use `prisma.model.delete()`. Always use soft deletes (`update` with `isActive: false` and `deletedAt: new Date()`).
- Financial metrics (e.g., `unitPrice`, `lineTotal`) must be snapshotted at the time of creation to prevent historical data mutation if menu prices change.
- Time-based metrics (e.g., `acceptedAt`, `readyAt`, `servedAt` for Orders) must be tracked strictly for SLA measurement.

---

## 🔐 RULE 20: NextAuth (Auth.js) Integration

All authentication is handled strictly via NextAuth (Auth.js):

- **Backend (Fastify)**: Implement `@auth/core` within the API routes (e.g., `/api/auth/*`).
- **Frontend (React)**: Do not use standalone JWT management. Rely on custom context hooks (e.g., `AuthContext.tsx`) built around NextAuth.
- **Session Strategy**: Use JWT sessions for stateless, scalable authentication.
- **CORS Requirements**: Fastify CORS must be explicitly configured to accept `credentials: true` and specifically allow the frontend origin. Fetch requests from React must include `credentials: 'include'`.

---

## 🧩 RULE 21: Strict OOP & Rich Domain Entities

Move away from Anaemic Domain Models. The core domain layer MUST encapsulate its own business logic:

- **Repositories Map to Domain Entities**: Repositories must retrieve raw Prisma DTOs and immediately map them into Rich Domain Entity classes (e.g., `new TableSession(data)`, `new Order(data)`).
- **Behavior Lives in the Class**: Use Cases must NOT directly manipulate raw database objects. Methods for state transition, validation, and domain rules must reside on the Entity class itself (e.g., `tableSession.close()`, `order.markServed()`).
- **Encapsulation**: State changes to an entity must only occur through its defined methods, ensuring invariants and business rules are always enforced.
