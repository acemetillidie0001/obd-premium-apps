Status: LOCKED (maintenance-mode safe)
Last verified: main @ cf181d50595e7c5dfeff1d0bcb14aa0cfa177012
Public, search-first, read-only discovery layer powered by a global AnythingLLM workspace. No automation.

# Help Center (Public)

## What this IS

- A **public, search-first discovery layer** for OBD Premium documentation.
- A **read-only answer surface**: returns answer text only (no actions).
- A **global-workspace** Help Center backed by AnythingLLM.

## What this is NOT

- Not tenant-scoped / not business-scoped.
- Not an uploader or knowledge manager.
- Not an account settings surface.
- Not a publisher or automation engine (no apply, no mutations).

## Boundaries

- **Global workspace only**: the workspace slug is enforced server-side (env); the client cannot set it.
- **No business data**: no business context is resolved, required, or accepted.
- **No uploads**: no document upload/import surfaces exist in the app.
- **No account actions**: no membership, billing, profile, or admin actions.
- **No publishing**: no “apply”, “send”, “schedule”, or “export” actions.

## Routes

- `/help-center` (public page)
- `POST /api/help-center/query`

## Env vars (names only)

- `HELP_CENTER_WORKSPACE_SLUG`
- `HELP_CENTER_ANYTHINGLLM_BASE_URL`
- `HELP_CENTER_ANYTHINGLLM_API_KEY`
- `HELP_CENTER_RATE_LIMIT_PER_MINUTE` (optional)

## Safety guarantees

- **Workspace slug forced from env** (client cannot set).
- **Fail-closed when config is missing** (safe error responses; no unsafe fallbacks).
- **Rate limit by IP** on the public endpoint.
- **Non-JSON/HTML guard + SSE-safe parsing** for upstream AnythingLLM responses.
- **Version-aware API prefix + route probing** to handle AnythingLLM variants safely.

## Operational note

- Seed docs live in `docs/help-center/**` and are ingested into the global workspace (outside the app).

