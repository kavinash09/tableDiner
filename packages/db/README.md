# Database Package (`@tablediner/db`)

This package isolates Prisma and the database schema from the rest of the application. It guarantees that `schema.prisma` is the absolute single source of truth for the domain entities. 

## 🐘 PostgreSQL Setup (Local Development via Docker)

*(In accordance with AI Rule 18, all container deployment instructions are documented inline rather than in standalone files.)*

To run a persistent PostgreSQL instance locally for development:

```bash
# 1. Create external volume directory on your machine (git-ignored)
mkdir -p .postgres_data

# 2. Run the PostgreSQL 16 container with external volume mapping
docker run -d \
  --name tablediner-postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=tablediner \
  -e POSTGRES_PASSWORD=tablediner_secret \
  -e POSTGRES_DB=tablediner \
  -p 5432:5432 \
  -v "$(pwd)/.postgres_data:/var/lib/postgresql/data" \
  postgres:16-alpine
```

### Environment Variable:
Update `.env` in the root and in `apps/api/.env`:
```env
DATABASE_URL="postgresql://tablediner:tablediner_secret@localhost:5432/tablediner?schema=public"
```

## 🚀 Getting Started

If you alter `prisma/schema.prisma`, you MUST synchronize the database and re-generate the Prisma client:

```bash
cd packages/db
npx prisma db push
npx prisma generate
```

## 🏗️ Seeding

To quickly populate the database with a dummy tenant, restaurant, menu, and admin user, run:

```bash
cd packages/db
npx tsx seed.ts
```

*The seed script will provision the `admin@tablediner.com` / `password123` user account.*

## 📂 Key Files
- `prisma/schema.prisma` — The data models. Employs soft-deletes (`isActive`) and hardens metrics (like denormalized `tenantId` and snapshotted prices).
- `seed.ts` — Idempotent development data seeder.
- `.postgres_data/` — Host-mapped persistent storage for local PostgreSQL Docker container.
- `tablediner.db` — Legacy local SQLite database file (git-ignored).

