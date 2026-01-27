# Teams & Users

## What this app IS

- The suite’s **tenant-scoped access control** foundation.
- A place to manage:
  - business memberships (Owner/Admin/Staff)
  - invites (tokenized invite links)
- A deny-by-default enforcement layer: if membership is missing/invalid, access is denied.

## What this app is NOT

- Not an enterprise IAM system.
- Not cross-business access (no cross-tenant visibility).
- Not an automation system:
  - no automatic provisioning
  - no background email sending by default

## What you typically get (outputs)

- A visible list of members and roles for a business.
- Invite links that can be copied and shared manually.
- Clear “disabled-not-hidden” UI for Staff (view-only).

## Draft & export behavior

- Teams & Users is not a “draft generator” tool, but it still follows review-first rules:
  - changes are explicit (invite, accept, cancel, role change)
  - no silent background mutations
- Invite workflow is designed around **copy link** (no auto-email automation implied).

## Integrations & boundaries

- Many apps rely on Teams & Users membership to determine business context (tenant safety).
- Business resolution is membership-derived and deny-by-default when mismatched.
- Demo mode (when enabled) enforces read-only behavior for mutation routes.

## Common questions

- **Why can’t I access an app?** You may not have an ACTIVE membership for that business.
- **What do roles mean?** Owner/Admin can manage access; Staff is typically view-only.
- **Does it auto-create businesses?** No—business creation is intentional (especially in production).
- **Are invites emailed automatically?** Not by default—invites are copy-link workflow.
- **Can Staff change settings?** No—controls are visible but disabled with tooltips.
- **Is this tenant-safe?** Yes—business context is derived from membership (deny-by-default).

