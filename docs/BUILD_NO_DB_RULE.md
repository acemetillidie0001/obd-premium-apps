# Build Script Database Prohibition Rule

## HARD RULE: Build Scripts MUST NOT Make Database Calls

**This is a non-negotiable architectural constraint.**

### Rule Statement

All build-related npm scripts (`build`, `build:prod`, `build:vercel`, `vercel-build`, `ci`, `postinstall`) **MUST NOT**:
- Connect to databases
- Run database migrations
- Execute database queries
- Call migration resolver scripts
- Validate database URLs
- Check database status

### Why This Rule Exists

1. **Build Independence**: Builds must work without database access
2. **Vercel Compatibility**: Vercel builds run in isolated environments without database access during build time
3. **CI/CD Reliability**: Build pipelines should not depend on external database availability
4. **Security**: Reduces attack surface by not requiring database credentials during builds
5. **Performance**: Faster builds without network I/O to databases

### What IS Allowed in Build Scripts

✅ **Allowed Operations:**
- `prisma generate` - Generates TypeScript types from schema (no DB connection)
- `next build` - Next.js build process
- Type checking, linting, testing
- File system operations
- Environment variable reading (but not DB validation)

### Build Scripts (DB-Free)

These scripts are validated to be database-free:

| Script | Purpose | Allowed Operations |
|--------|---------|-------------------|
| `build` | Standard Next.js build | `next build` only |
| `build:prod` | Production build | Calls `build` |
| `build:vercel` | Vercel-specific build | `prisma generate` + `next build` |
| `vercel-build` | Vercel build command | Calls `build:vercel` |
| `ci` | CI pipeline | `validate:build-no-db` + `check` + `vercel-build` |
| `postinstall` | Post-install hook | `prisma generate` only |

### Database Operations (Ops-Only)

These scripts require database access and **MUST NOT** be called from build scripts:

| Script | Purpose | Database Operations |
|--------|---------|-------------------|
| `migrate:deploy` | Deploy migrations | `prisma migrate deploy` |
| `db:deploy` | Deploy migrations | `prisma migrate deploy` |
| `db:sync` | Sync schema | `prisma migrate deploy` |
| `db:resolve:all` | Resolve failed migrations | Database queries + updates |
| `db:check` | Check migration status | Database queries |
| `db:status` | Migration status | Database queries |
| All `db:*` scripts | Database operations | Various database operations |

### Validation

The repository includes an automated validator:

```bash
pnpm run validate:build-no-db
```

This script:
- Checks all build scripts for forbidden database operations
- Validates that build scripts don't call database operation scripts
- Fails CI if any violations are found

### CI Integration

The `ci` script automatically runs validation:

```json
"ci": "pnpm -s validate:build-no-db && pnpm -s check && pnpm -s vercel-build"
```

This ensures that:
1. Build scripts are validated before running
2. No database operations can slip into build scripts
3. CI will fail if the rule is violated

### Adding New Build Scripts

When adding new build-related scripts:

1. **Add to validation**: Update `tools/validate-build-no-db.cjs` `BUILD_SCRIPTS` array
2. **Verify no DB calls**: Run `pnpm run validate:build-no-db`
3. **Document**: Add to this file's "Build Scripts" table

### Adding New Database Operations

When adding new database operation scripts:

1. **Use `db:*` or `migrate:*` prefix**: Makes it clear these are database operations
2. **DO NOT call from build scripts**: Never reference in `build`, `vercel-build`, `ci`, etc.
3. **Document**: Add to this file's "Database Operations" table

### Enforcement

- ✅ Automated validation in CI
- ✅ Validation script prevents accidental violations
- ✅ Clear separation of build vs. ops scripts
- ✅ Documentation of allowed/forbidden operations

### Migration Deployment

Database migrations are deployed **separately** from builds:

1. **Build**: `pnpm run vercel-build` (no DB access)
2. **Deploy Migration**: `pnpm run migrate:deploy` (requires DB access)

These are **separate operations** that happen at different times:
- Build: During Vercel deployment (no DB)
- Migration: Before/after deployment via separate command or CI workflow

### Troubleshooting

**Q: Build fails with "database connection" error**

A: Check if any build script calls a database operation. Run `pnpm run validate:build-no-db` to find violations.

**Q: How do I run migrations during deployment?**

A: Use a separate CI workflow (see `.github/workflows/prisma-migrate.yml`) or run `pnpm run migrate:deploy` manually after deployment.

**Q: Can I add a database check to a build script?**

A: No. Use a separate ops script (e.g., `db:check`) and run it separately from the build.

### References

- Validation script: `tools/validate-build-no-db.cjs`
- CI workflow: `.github/workflows/test.yml`
- Migration workflow: `.github/workflows/prisma-migrate.yml`

