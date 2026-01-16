# Prisma Migrations (Dev + Prod) — Shadow DB Workaround

This repo occasionally hits a Prisma **shadow database** issue that can block `prisma migrate dev` on some machines/environments. We do **not** “fix” this by resetting databases.

This doc describes the **approved, low-risk workaround** used in this repo: **manual SQL migration files** + `prisma migrate deploy`.

---

## Symptom (what you’ll see)

When running `prisma migrate dev` (or `--create-only`), Prisma may fail with a message similar to:

- Error code **P3006**
- Mentions **shadow database**
- “Failed to apply migration … to the shadow database”

This is an environment + migration history interaction. It is **not** safe to “solve” by dropping/resetting databases in a shared repo.

---

## Approved workaround (used in this repo)

We create migrations **manually**:

1. Update the Prisma schema (`prisma/schema.prisma`)
2. Add a new migration folder with a **manual** `migration.sql`:
   - `prisma/migrations/<timestamp>_<name>/migration.sql`
3. Regenerate Prisma client:
   - `pnpm -s prisma:generate`
4. Apply migrations using **deploy** (safe for CI/prod-style flows):
   - `pnpm -s prisma:migrate:deploy`

This avoids shadow DB checks while still keeping a consistent migration history.

---

## Dev vs Prod: how to apply safely

### Local dev (with a real dev DB)

- Apply pending migrations:

```bash
pnpm -s prisma:migrate:status
pnpm -s prisma:migrate:deploy
```

### Production / CI / Vercel

- Use deploy-style migrations only (no shadow DB):

```bash
pnpm -s prisma:migrate:deploy
```

---

## Optional helper: `prisma:migrate:safe`

This repo includes a wrapper that runs Prisma commands but prints guidance if a shadow DB failure is detected:

```bash
pnpm prisma:migrate:safe migrate dev --create-only --name add_feature_x
```

If it hits the shadow DB error, it prints the manual-migration workflow above.

---

## SEO Audit manual migrations (discoverable reference)

The SEO Audit & Roadmap features intentionally used manual SQL migrations:

- `prisma/migrations/20260115220000_add_seo_audit_report/migration.sql`
  - Adds `SeoAuditReport` snapshot table and enum
- `prisma/migrations/20260116003000_add_seo_audit_share_token/migration.sql`
  - Adds `SeoAuditShareToken` for expiring read-only share links

These are good examples to copy for future schema changes when shadow DB issues appear.

---

## Safety constraints (do not violate)

- **Do not** run destructive resets (`prisma migrate reset`, dropping DBs, etc.) as a “fix”.
- Prefer **manual migrations** + `migrate deploy` when shadow DB failures happen.
- Keep migrations deterministic and reviewed (SQL is the source of truth in this workaround).


