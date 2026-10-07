# RETRIEVAL & UPDATE STRATEGY (VIBECODING MEMORY PROTOCOL)

To maintain perfect context across sessions, the Agent MUST follow this lifecycle for EVERY interaction.

## 📥 PHASE 1: INGESTION (Start of Task)
1. Read `.ai/PROJECT_CONTEXT.md` — understand the business goal and what is OUT of scope.
2. Read `.ai/PROJECT_STATE.md` — know what is built vs pending.
3. Read `.ai/CURRENT_TASK.md` — identify the immediate next objective.
4. Read `.ai/ARCHITECTURE.md` — respect port assignments, API contracts, and package status.
5. Read `.ai/DECISIONS.md` — understand WHY choices were made (prevents re-litigating).

## 🔬 PHASE 1.5: SANITY CHECK (MANDATORY — Do This Before Writing Code)
**The brain files can drift from reality. Always verify before trusting them.**

1. Scan `apps/api/src/index.ts` — count the actual routes. If they don't match the route table in `ARCHITECTURE.md`, **update ARCHITECTURE.md first** before writing any code.
2. Check `packages/shared-types/src/index.ts` — if it still contains `export {}`, do NOT generate any imports from it. Note this in your plan.
3. Check `packages/shared-validation/src/index.ts` — same rule as above.
4. Verify the `dev` script in `apps/api/package.json` uses `tsx`, not `ts-node`. If it still says `ts-node`, flag it.

> If any sanity check fails, **fix the brain files first**, then proceed with the user's request.

## 🔨 PHASE 2: EXECUTION
1. Search code explicitly — NEVER exclude `.ai` or hidden folders from file discovery.
2. Implement following `AI_RULES.md` and `docs/IMPLEMENTATION_MAP.md`.
3. Use `VITE_API_URL` env var for all API calls in frontend apps. Never hardcode `localhost`.
4. Always add try/catch to Fastify route handlers. Unhandled Prisma errors crash the process.

## 💾 PHASE 3: THE STATE CHECKPOINT (MANDATORY BEFORE STOPPING)
Before concluding ANY task, evaluate every item below and update if changed:

- [ ] `DECISIONS.md`: New tool, pattern, schema, or reversal? **APPEND** (never overwrite). Include *why*, not just *what*.
- [ ] `ARCHITECTURE.md`: New route, new port, new package, changed data flow? **Update the route table and port registry**.
- [ ] `PROJECT_STATE.md`: Finished a module? Check it off. Started a new phase? Update the label.
- [ ] `CURRENT_TASK.md`: Finished the current goal? **Replace with the next forward-looking task and sub-steps** — never leave it as a done-state retrospective.
- [ ] App `README.md`: Did deployment, env vars, or startup instructions change? Update the relevant app README.
- [ ] Root `README.md`: Did overall project status change significantly? Update "Current Setup Status".
