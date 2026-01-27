# AI Help Desk (In-App)

## What this app IS

- A **tenant-scoped** (business-scoped) search + Q&A tool powered by AnythingLLM.
- A way to answer questions using **your business’s saved knowledge** (not the open web).
- A UI with explicit trust microcopy (“draft-only / no automation”) and deterministic state indicators (knowledge status).

## What this app is NOT

- Not the public Help Center (the Help Center is global + read-only).
- Not web browsing / not live internet answers.
- Not an auto-publisher or background automation system.
- Not cross-tenant knowledge (no cross-business access).

## What you typically get (outputs)

- **Search results** (snippets from saved knowledge).
- **Chat answers** with optional **sources**.
- Knowledge status indicator (Empty / Partial / Ready).

## Draft & export behavior

- Answers are **advisory** and **read-only** by default.
- Any “import/apply” flow is **user-initiated** and **apply-only** (review-first).
- No automatic publishing or external system updates.

## Integrations & boundaries

- **Tenant safety**: requests are scoped by `businessId → workspaceSlug` mapping (server-side).
- **Cross-app routing**:
  - “Next Steps” panels are **link-only** (no payload transfer).
  - Handoffs (when present) are **session-only**, TTL’d, and require explicit confirmation (apply-only).
- The in-app Help Desk is separate from the **Help Center global workspace**.

## Common questions

- **Does it browse the web?** No—answers are based on saved knowledge only.
- **Can it publish or send anything?** No—draft-only, no automation.
- **Is it tenant-safe?** Yes—workspace mapping prevents cross-business access.
- **What are “sources”?** Saved entries/documents used to support an answer (when available).
- **Can it change other apps?** Not automatically; cross-app flows are link-only or apply-only.
- **Why might an answer be weak?** If the workspace has limited documents or an empty system prompt.

