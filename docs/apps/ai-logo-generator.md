# AI Logo Generator — Tier 5A + Tier 5B+ + Tier 5C+ + Tier 6 (Fallback) Implementation

**Status:** ✅ Production Ready (STABLE / LIVE)  
**Last Updated:** 2026-01-15

## Overview

AI Logo Generator helps you generate **draft-first** logo concepts (descriptions, style notes, color palettes, and AI-ready prompts). Optionally, it can also render images inside the app.

This app is **draft-only by default**:
- It does not publish anything externally.
- It does not auto-apply changes in other apps.
- It does not auto-save downstream settings.

## Inputs

### Required
- **Business name**
- **Business type**

### Optional
- Services
- City / State
- Brand voice
- Personality style
- Logo style
- Color preferences
- Include text (name) vs icon-only
- Variations count (clamped to **3–8**)
- “Generate images” toggle (slower)

## Outputs

Each generated logo card includes:
- **Name** (draft-only, editable)
- **Favorite** (draft-only)
- **Edited badge** when local per-card metadata differs from defaults
- **Style notes**
- **Color palette**
- **Prompt** (for image generation tools)
- Optional **image preview** (if images were generated)

### Rename / favorite behavior (draft-only)

- **Rename**
  - Enter: commits
  - Escape: cancels
  - Blur: commits
  - Empty name is blocked (keeps previous name)
- **Favorites**
  - Favorites sort to the top while preserving stable order within favorites/non-favorites
- **Persistence**
  - Rename/favorite are **session-local UI state** today (not saved to a database).

## Preview zoom (lightbox)

If an image exists, clicking the image opens a preview modal:
- **Escape closes**
- **Focus is trapped** while open
- **Focus returns** to the triggering element on close

## Integrations (Tier 5C+)

All integrations are **apply-only** and **draft-only**. Nothing is auto-posted, auto-queued, or auto-saved.

### Social Auto-Poster (draft-only, apply-only)

- AI Logo Generator sends a **draft media handoff** (with TTL) to Social Auto-Poster.
- Social Auto-Poster shows an **import banner**.
- Import is **apply-only**: it adds draft media and does **not** auto-generate captions or auto-queue posts.
- Tenant safety: receiver checks **businessId** and blocks apply on mismatch.
- URL cleanup: `?handoff=1` is removed after Apply/Dismiss.

### Brand Kit Builder (suggested mark only)

- AI Logo Generator can send logos as a **draft “Suggested brand mark”** suggestion.
- Brand Kit receiver:
  - Shows an import banner when arriving with `?handoff=1`
  - Enforces tenant mismatch guard (URL businessId must match payload businessId)
  - Apply adds a **draft** suggested mark entry only (no overwrite, no auto-save)
  - Provides a **Clear suggested brand mark** action (draft-only)
  - Cleans URL params after apply/dismiss

### AI Help Desk (suggested icon only)

- AI Logo Generator can send a logo as a **draft icon/avatar suggestion** for the Help Desk widget.
- Help Desk receiver (Widget settings):
  - Apply prefills the **avatar URL field only**
  - User must click **Save Settings** to persist
  - Provides **Clear suggested avatar** (draft-only) to revert the applied suggestion
  - Cleans URL params after apply/dismiss

## Exports (Tier 6 fallback)

### Single export (text file)

- “Export” downloads a **single .txt** containing the generated concepts and prompts.

### Bulk export (multi-download fallback)

Bulk export downloads multiple files (best-effort):
- For each logo:
  - `*.prompt.txt`
  - `*.palette.json`
  - `*.png/jpg/webp/...` image (if available and fetch succeeds)
- Plus a **manifest JSON** containing:
  - batch metadata (timestamp, businessId)
  - all exported items
  - a failures list (per-item reason)

**Throttling hardening**:
- Downloads are **serialized** (concurrency=1) with a small inter-download delay to reduce browser throttling/blocking.

**Completion UX**:
- After finishing, a calm summary panel shows **success/failure counts** and notes that the manifest was downloaded.

## Guardrails & safety rules

- **Authentication required** to generate (API is session-protected).
- **Demo mode read-only**: demo requests do not mutate and do not call paid AI services.
- **No external publishing**: no social posting, no CMS publishing, no third-party writes.
- **Apply-only handoffs**: receivers require explicit user actions (Apply / Save).
- **Tenant safety**:
  - Handoff payloads include `businessId` and TTL.
  - Receivers block Apply on missing/mismatched businessId.
  - URL cleanup removes handoff params after Apply/Dismiss.


