# Database Package (`@tablediner/db`)

Contains the Prisma schema and the generated Prisma Client. This is the single source of truth for the data layer across the entire monorepo.

## 🚀 Getting Started
1. Run `pnpm install` at the root.
2. Run `npx prisma generate` to generate the client.
3. Run `npx prisma db push` to push the schema to your local SQLite file (`tablediner.db`).

## 🛠️ Modifying the Schema
Modify `prisma/schema.prisma` and ensure you run the Agent's "State Checkpoint" to update the `.ai/` documentation if architectural changes occur.

