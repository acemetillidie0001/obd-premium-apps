## AI Social Media Post Creator (SMPC)

> **Status**: **LOCK-eligible (maintenance-mode safe)**
>
> **Last verified**: `main @ <COMMIT_HASH_PLACEHOLDER>`
>
> **Trust contract**: Draft-only social post workbench. **No posting, no scheduling, no automation.**

### What this app IS

- **Draft-first generator + editor + export tool** for platform-aware social posts.
- A safe place to:
  - generate structured posts (Hook / Body / CTA)
  - apply deterministic Fix Packs + Quality Controls
  - manually edit posts with Save/Cancel (explicit edits only)
  - export/copy authoritative posts for downstream use

### What this app is NOT

- Not a posting tool.
- Not a scheduler.
- Not an automation system (no background posting, queueing, or calendar actions).
- Not a performance analytics tool (no “best time to post”, no engagement tracking).

### Tier 5A UX summary (accordion + sticky action cluster + trust copy)

- **Accordion inputs** with collapsed summary lines (Business Basics, Platform & Campaign, Brand & Voice, Output Settings).
- **Sticky action cluster** (predictable primary/secondary actions + disabled-not-hidden).
- **Trust microcopy** is always visible:
  - “Draft-only. Nothing is posted or scheduled automatically.”

### Tier 5B canonical model + selector

- **Canonical post model**: `src/lib/apps/social-media-post-creator/types.ts`
  - `SMPCPostItem` holds stable `id`, platform, active fields, and snapshots:
    - `generated`: parsed baseline
    - `edited`: optional edited snapshot (manual edits or Fix Packs)
- **Canonical selector**: `src/lib/apps/social-media-post-creator/getActivePosts.ts`
  - **Explicit rule**: **Edited > Generated**
  - Selector status: `draft | generated | edited`
- **Regenerate safety**: regenerate updates the latest generated baseline but **never overwrites edited content** (edited remains authoritative).

### Editing model (explicit Save/Cancel)

- **Per-post editing**:
  - Enter edit mode per post card
  - Modify Hook / Body / CTA
  - **Save** commits edits into the edited layer (explicit mutation)
  - **Cancel** discards changes (no mutation)
- **Reset behaviors**:
  - **Reset to generated** (per post): clears edited snapshot for that post only
  - **Reset all edits**: clears `editedPosts` entirely (generated remains)
- **Fix Packs compatibility**:
  - Fix Packs output is treated as **edited** content (edited layer)
  - Undo history is maintained as an in-memory stack of edited states

### Export integrity (authoritative exports)

- Export Center + Copy Bundles **always** export from the **active structured posts** (Edited > Generated), using the same resolved ordering used in the UI.
- The raw AI response text is kept **reference-only** and is clearly labeled as such.

### Tier 5C ecosystem integration (SMPC → Social Auto-Poster)

- **Draft-only handoff** to Social Auto-Poster using sessionStorage with TTL:
  - Builder: `src/lib/apps/social-media-post-creator/handoff.ts`
  - Sender UI: `src/app/apps/social-media-post-creator/page.tsx`
- Receiver is in Social Auto-Poster composer:
  - `src/app/apps/social-auto-poster/composer/page.tsx`
- **Receiver guardrails**
  - Apply/Dismiss modal (no auto-apply)
  - **Additive-only** import (append drafts; never wipe existing state)
  - Basic dedupe (platform + exact text)
  - **Tenant-safe**: businessId must match (deny-by-default)
  - Clears payload on Apply/Dismiss/expiry/invalid

