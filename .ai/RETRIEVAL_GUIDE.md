# RETRIEVAL & UPDATE STRATEGY (VIBECODING MEMORY PROTOCOL)

To maintain perfect context across sessions, the Agent MUST follow this lifecycle for EVERY interaction.

## 📥 PHASE 1: INGESTION (Start of Task)
1. Read `.ai/PROJECT_CONTEXT.md` (Understand the business goal).
2. Read `.ai/PROJECT_STATE.md` (Know what is built vs pending).
3. Read `.ai/CURRENT_TASK.md` (Identify immediate objective).
4. Read `.ai/ARCHITECTURE.md` & `.ai/DECISIONS.md` (Respect constraints).

## 🔨 PHASE 2: EXECUTION
1. Search code explicitly (Never exclude `.ai` or hidden folders).
2. Implement following `AI_RULES.md` and `docs/IMPLEMENTATION_MAP.md`.

## 💾 PHASE 3: THE STATE CHECKPOINT (MANDATORY BEFORE STOPPING)
Before concluding any task, the Agent MUST evaluate if state has changed and update the following:
- [ ] `DECISIONS.md`: Did we pick a new tool, pattern, or schema? Log it.
- [ ] `ARCHITECTURE.md`: Did we change how apps communicate? Log it.
- [ ] `PROJECT_STATE.md`: Did we finish a module? Check it off.
- [ ] `CURRENT_TASK.md`: Did we finish the goal? Queue the next one.
