# Antigravity Agent Rules for TableDiner

These rules are injected into every conversation to ensure strict adherence to the project's vibe-coding guardrails.

1. **Context is King**: You must always search for and read `.ai/PROJECT_CONTEXT.md`, `.ai/PROJECT_STATE.md`, `.ai/DECISIONS.md`, and `.ai/CURRENT_TASK.md` before making any coding decisions.
2. **Do Not Ignore Hidden Folders**: When discovering files, ensure you never filter out the `.ai` folder. It is the brain of this repository.
3. **Always Update State**: At the conclusion of every major step or decision, you MUST update `.ai/CURRENT_TASK.md`, `.ai/PROJECT_STATE.md`, and `.ai/DECISIONS.md` so the context is preserved for future sessions.
4. **Strictly Follow the Constitution**: Adhere entirely to the architectural rules and constraints laid out in `.ai/AI_RULES.md`.
5. **No Silent Assumptions**: If a requirement is ambiguous, ask the user. Do not guess the business logic.
6. **Maintain Local Readmes**: EVERY app and package must have a local `README.md` (e.g. `apps/api/README.md`). You MUST update these religiously whenever deployment, environment, or functional workings change.
7. **Environment & Git Hygiene**: You MUST maintain `.gitignore`, `.nvmrc`, and `.vscode/settings.json` to lock the developer environment and ensure no junk is pushed to VCS.
