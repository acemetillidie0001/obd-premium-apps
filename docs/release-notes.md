# Release Notes

This file contains chronological release notes for all OBD applications and features.

---

## 2026-01-03: AI Business Description Writer V3+ UX & Workflow Upgrade

**App:** AI Business Description Writer (BDW)  
**Status:** V3+ UX + workflow upgrade  
**Version:** V3+ (Tier 1–Tier 3)

### Overview

Comprehensive UX and workflow upgrade across three tiers, transforming BDW into a more intuitive, powerful, and user-friendly description generation and optimization platform.

**No Breaking Changes:** All features are additive and backward compatible.  
**No Prisma / API Changes:** Frontend-only release. No database migrations or API endpoint changes required.

### Tier 1: UI Refactor + Copy Workflow

- **Two-Level Tabs**: Destination Output (Level 1) + Content Packs (Level 2)
- **Collapsible Content Packs**: Independent collapse/expand with preview text
- **Copy Buttons Per Block**: Individual copy buttons with "Copied!" confirmation
- **Copy Bundles**: GBP Bundle, Website Bundle, Full Marketing Pack
- **Regenerate Dropdown**: Modes for All, Destination Output only, or Content Packs only with safe merge behavior

### Tier 2: Fix Packs Preview + Safety

- **Non-Destructive Fix Pack Preview Modal**: Before/After comparison with character counts and deltas
- **Apply / Apply as New Version**: Explicit approval required for all changes
- **Undo with Toast**: Single-level undo with toast notification
- **AI Recommended Opens Preview**: No auto-apply; user must review and approve
- **Eligibility Gating + No-Op Prevention**: Smart fix pack availability
- **Shared safeTrimToLimit Utility**: Consistent length trimming
- **Fix Pack Wiring**: Optimize Meta + Optimize Length

### Tier 3: Power User Features

**Option A: Export Center**
- Copy as plain/markdown/html snippet
- Download .txt/.md files
- Paste-ready blocks
- Shared export formatters (refactored Copy Bundles to reuse helpers)

**Option B: Brand Profile**
- Presets for brand voice, personality style, writing preferences
- localStorage persistence
- Fill-empty-only default + overwrite mode

**Option C: Saved Versions Workspace**
- Drawer/modal workspace
- Rename/tags local metadata + clear metadata
- Compare mode with guardrails + swap sides
- Loaded Saved Version banner + reset-to-loaded snapshot
- Duplicate clarity toast
- Delete safety clearing compare mode

**Option D: Quality Controls**
- Hype words, repetition, keyword repetition, readability estimate
- Safe fixes via preview modal (Soften hype words, Remove duplicates)

### Key Notes

- **Deterministic Transformations**: All fix packs and quality controls use rule-based transformations (no AI calls)
- **Known Limitations**: localStorage-based metadata (device-specific), single-level undo, compare mode limitations
- **Next Recommended Upgrades**: Multi-level undo stack, cloud-synced brand profiles, version metadata in database, advanced compare mode, AI-powered fix suggestions, export templates, quality control enhancements

**Full Documentation:** [Business Description Writer V3+ UX Upgrade Release Notes](releases/business-description-writer-v3-ux-upgrade.md)

---

