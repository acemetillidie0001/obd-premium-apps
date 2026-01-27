# Help Center Scope (Public, Read-Only)

## What the Help Center can do

- Explain how OBD tools work (at a conceptual level).
- Clarify terminology (draft-only, apply-only, exports, handoffs, tenant safety).
- Provide safe workflows (“review-first” steps) and usage guidance.
- Answer common questions using **saved OBD documentation and saved knowledge**.

## What the Help Center cannot do

- It cannot access your business-scoped data (no tenant context).
- It cannot upload knowledge, save settings, or change your account.
- It cannot publish, schedule, or “apply changes” to external systems.
- It cannot browse the web or use live internet sources.

## Why it does not access business data

The Help Center is intentionally public and global:
- It uses a **dedicated global workspace** for shared, public-safe guidance.
- It does not resolve a user identity or a `businessId`.
- Workspace selection is server-controlled (environment variables only), not client-controlled.

## When to use Help Center vs in-app AI Help Desk

Use **Help Center** when:
- you want shared guidance that applies across the suite
- you want definitions, safe workflows, and general explanations

Use **AI Help Desk (in-app)** when:
- you need business-specific answers tied to your saved knowledge base
- you need tenant-scoped help that depends on your workspace content

## Explicit boundaries (repeatable)

- No uploads
- No account actions
- No settings management
- No publishing
- No automation
- Read-only discovery + Q&A only

