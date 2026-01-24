# Teams & Users (MVP)

## What it is

Teams & Users is the suite’s **tenant-scoped access control** foundation:

- **Business identity**: `Business.id` is the canonical tenant key.
- **Memberships**: `BusinessUser` maps users to businesses with roles (`OWNER`, `ADMIN`, `STAFF`) and status (`ACTIVE`, `SUSPENDED`).
- **Invites**: `TeamInvite` supports tokenized invitations (hash stored, raw token never stored) with expiry and cancel/accept lifecycle.
- **UI**: `/apps/teams-users` provides a calm management console with disabled-not-hidden controls for Staff.

## What it is NOT

- **Not billing**: no subscription, invoices, or plan management.
- **Not automation**: no email sending, no background jobs, no cron.
- **Not an org directory**: no cross-business discovery and no global user search.
- **Not a multi-business selector (yet)**: v1 assumes “one primary business per user” (backfilled as OWNER).

## Roles

- **OWNER**
  - Full access to manage members + invites.
  - Safety rules prevent lockout (cannot remove/demote/suspend the last active owner).
- **ADMIN**
  - Can manage members + invites.
  - Billing is intentionally out of scope.
- **STAFF**
  - View-only in the UI.
  - Management actions are visible but **disabled with tooltip explanations** (disabled-not-hidden).

## Invite flow (tokenized, no email automation)

### Create invite

- Endpoint: `POST /api/teams-users/invites`
- Requires: authenticated **OWNER/ADMIN**
- Behavior:
  - Normalizes email (`trim().toLowerCase()`).
  - Prevents inviting an email that already belongs to an **ACTIVE** membership in that business.
  - Prevents multiple active invites per email per business (enforced in code).
  - Generates a random token; stores `sha256(token)` in `tokenHash`.
  - Sets `expiresAt = now + 7 days`.
  - Returns an **inviteLink** for MVP “copy link” workflow (no email sending).

### Accept invite

- Endpoint: `POST /api/teams-users/invites/accept` with `{ token }`
- Requires: authenticated session
- Enforced rules:
  - Invite must exist, be unexpired, not canceled, not already accepted.
  - `session.user.email` must match `invite.email` (case-insensitive).
  - Creates `BusinessUser` membership for `invite.businessId` with `role = invite.role`, `status = ACTIVE`.
  - Marks `acceptedAt`.

### Cancel invite

- Endpoint: `DELETE /api/teams-users/invites?id=...`
- Requires: authenticated **OWNER/ADMIN**
- Behavior: sets `canceledAt` (idempotent).

## Tenant safety guarantees (Phase 1)

### Deny-by-default tenant resolution

Server-side business context is resolved by **membership**, not by `?businessId=`:

- `src/lib/auth/requireBusinessContext.ts` derives `{ userId, businessId, role }` from an **ACTIVE** `BusinessUser` membership.
- `src/lib/utils/resolve-business-id.server.ts`:
  - **Demo cookie override** → demo business id
  - **Membership-derived business** → default
  - Optional `?businessId=` is only treated as a selector if it matches an ACTIVE membership
  - Otherwise returns `null` (deny-by-default)

### Route scoping

Teams & Users routes are tenant-scoped and role-enforced:

- `GET/PATCH/DELETE /api/teams-users/members`
- `GET/POST/DELETE /api/teams-users/invites`
- `POST /api/teams-users/invites/accept`

### Demo mode

Mutation routes participate in demo-mode read-only enforcement via `assertNotDemoRequest()`.

## Determinism notes

- Membership selection is deterministic:
  - If multiple ACTIVE memberships exist, pick the **oldest OWNER** membership; otherwise the oldest membership (by `createdAt`).
- “Last owner” safety rules are enforced server-side to prevent lockout:
  - cannot demote/suspend/remove the **last ACTIVE OWNER**
  - cannot remove/suspend/demote yourself if you are the last ACTIVE OWNER

## No automation / background jobs

- No invitation emails are sent.
- No scheduled jobs exist for invites.
- Expiry is evaluated at read-time (pending = `acceptedAt` null AND `canceledAt` null AND `expiresAt > now`).

