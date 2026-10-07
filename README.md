# TableDiner AI-First Starter 🍽️

TableDiner is a modern, AI-first QR-code based ordering platform for restaurants designed to route real, paid orders directly to the kitchen with zero friction.

## 🗺️ Project Navigation
Before diving in, please review our core documentation:
1. [`.ai/PROJECT_CONTEXT.md`](./.ai/PROJECT_CONTEXT.md) - Core product goals and MVP scope.
2. [`.ai/AI_RULES.md`](./.ai/AI_RULES.md) - AI constitution and development rules.
3. [`docs/PRD.md`](./docs/PRD.md) - Product Requirements Document.
4. [`docs/DOMAIN_MODEL.md`](./docs/DOMAIN_MODEL.md) - High-level entity relationships.
5. [`docs/IMPLEMENTATION_MAP.md`](./docs/IMPLEMENTATION_MAP.md) - Step-by-step journey of how we are building this MVP.

## 🚀 Getting Started (Work in Progress)

*Note: The project is currently progressing through the Implementation Map. Setup instructions will evolve as we wire the monorepo and build the applications.*

### Prerequisites
- Node.js (v18+)
- Package manager (npm/yarn/pnpm)

### Current Setup Status
Currently, we have completed **Chapter 1: Database Foundations**. The database schema is fully defined using Prisma and SQLite.

To view or interact with the database schema:
1. Navigate to the database package:
   ```bash
   cd packages/db
   ```
2. View the schema at `prisma/schema.prisma`.

*(Coming Soon): Once **Chapter 2: The Monorepo Wiring** is complete, this section will include the commands to install dependencies (`npm install`) and start the development servers for all applications simultaneously.*
