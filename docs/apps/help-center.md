# Help Center (Public)

## Status Banner

Status: LOCKED (maintenance-mode safe)
Last verified: main @ 112c58d572659a9dc515ee46c80a723e3281d387
One-liner: Public, search-first, read-only discovery layer powered by a global AI Help Desk workspace. No automation.

## Overview

The Help Center is a **public**, **read-only** interface for searching and asking questions against a dedicated **global AnythingLLM workspace** (not business-scoped).

It is designed to be calm, trust-first, and safe-by-default:
- No tenant access
- No automation
- No mutation

## What this page IS

- **Search-first discovery**: a single entry point to ask questions and get guidance.
- **Read-only answers**: responses are generated from **saved OBD documentation and saved knowledge only**.
- **Global workspace only**: the backend queries a forced workspace slug (server-side env).
- **Rate-limited**: public endpoint is IP rate-limited to reduce abuse.

## What this page is NOT

- Not a business/tenant-scoped Help Desk
- Not an admin console
- Not an uploader / knowledge manager
- Not an automation engine (no publishing, no “apply”, no “fix it for me”)
- Not web browsing / not live internet answers
- Not a settings surface (no brand voice, integrations, accounts, or permissions)

## Data boundaries (fail-closed)

- **Global workspace only**:
  - Workspace slug is **forced from environment variables** (never accepted from the client).
  - Requests cannot provide `businessId` or `workspaceSlug`.
- **No tenant scoping**:
  - The Help Center endpoint does **not** resolve or use a user identity.
  - No access to business-scoped knowledge bases.
- **No uploads / no mutation**:
  - No write endpoints are exposed for Help Center.
  - No importing, saving, exporting, applying, publishing, or updating anything.

## Safety notes (public-safe, fail-closed)

- **Workspace slug is forced server-side** (env only). The client cannot select a workspace.
- **Rate-limited** by IP to reduce abuse (`HELP_CENTER_RATE_LIMIT_PER_MINUTE`).
- **Strict request schema**: rejects extra fields (no `businessId`, no `workspaceSlug`).
- **Safe logging**: query text is not logged (logs record **query length only**).
- **Upstream guardrails**: upstream non-JSON/HTML responses are handled safely and return a generic message.

## Environment variables

```bash
# AnythingLLM instance origin (no /api path)
HELP_CENTER_ANYTHINGLLM_BASE_URL=https://anythingllm.example.com

# Help Center query-only key (recommended: read/query permissions only)
HELP_CENTER_ANYTHINGLLM_API_KEY=...

# Forced global workspace slug (server-side only)
HELP_CENTER_WORKSPACE_SLUG=obd-help-center

# Public IP rate limit (requests per minute)
HELP_CENTER_RATE_LIMIT_PER_MINUTE=30
```

## Routes

- Page:
  - `/help-center`
- API:
  - `POST /api/help-center/query`
    - Request: `{ "query": "string" }`
    - Response: `{ "answer": "string", "sources"?: any[], "meta"?: { "workspace": "string" } }`

## Relationship to AI Help Desk

- **AI Help Desk (tenant-scoped)**: `/apps/ai-help-desk` uses business→workspace mapping for tenant isolation.
- **Help Center (global)**: `/help-center` queries a dedicated global workspace for public, read-only discovery.

