# Meta App Review — Publishing Permissions Submission Pack (Social Auto-Poster)

**Purpose**: Submit Meta App Review for **publishing** permissions used to post to **Facebook Pages** and **Instagram Business accounts** from the Social Auto-Poster.

**Product**: OBD Business Suite → Social Auto-Poster  
**Primary UX entry**: `/apps/social-auto-poster/setup`

**Commitment**: **Manual publish only. No automation. No background jobs.**  
Publishing happens only when a user explicitly clicks a publish action (e.g., “Send Test Post”). No unattended posting.

---

## Permissions requested (exact list)

**Facebook Pages**

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

**Instagram (Content Publishing API)**

- `instagram_basic`
- `instagram_content_publish`

---

## Why we need this (per permission)

- **`pages_show_list`**: Allows the user to view and select which Facebook Page they manage to post to. We use this only to show a list of eligible Pages for user selection.
- **`pages_read_engagement`**: Allows us to validate Page access and display basic Page-related status needed for setup (e.g., confirming Pages access and supporting Page selection).
- **`pages_manage_posts`**: Allows the user to publish a post to the selected Facebook Page when they explicitly click a publishing action (e.g., “Send Test Post”).
- **`instagram_basic`**: Allows us to read basic Instagram Business account info (e.g., username/ID) to confirm the linked Instagram Business account and show it to the user in setup.
- **`instagram_content_publish`**: Allows the user to publish a post to the linked Instagram Business account when they explicitly click a publishing action (e.g., “Send Test Post”).

---

## Reviewer step-by-step (end-to-end)

### 0) Preconditions (reviewer-friendly)

- You have a test Facebook user with access to:
  - at least one **Facebook Page** the user can publish to
  - an **Instagram Business/Creator** account linked to that Page (optional but recommended)
- Environment:
  - `META_APP_ID` and `META_APP_SECRET` set
  - `META_REVIEW_MODE=true` (recommended for the review walkthrough banner and safe guidance)
  - `META_PUBLISHING_ENABLED`:
    - **Option A (full success path)**: set to `true` to allow “Send Test Post” to publish
    - **Option B (intentionally disabled path)**: set to `false` to demonstrate deterministic “Publishing disabled” response

### 1) Login → open Setup

1. Log in to the product.
2. Navigate to: `/apps/social-auto-poster/setup`
3. In the Meta section, click **Connect Facebook** (basic login).

**Expected**:

- You are redirected to Meta’s consent screen for the basic login.
- After completing consent, you return to Setup and see Meta as connected.

### 2) Enable Pages access (Page selection prerequisite)

1. On Setup, click **Enable Pages Access**.

**Expected**:

- You are redirected to Meta’s consent screen requesting Page listing/read permissions.
- After completing consent, you return to Setup and Page selection UI becomes available.

### 3) Request Publishing Access (NEW explicit OAuth step)

1. On Setup, in **Publishing Access**, click **Request Publishing Access**.

**Expected**:

- You are redirected to Meta’s consent screen requesting:
  - `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`,
  - `instagram_basic`, `instagram_content_publish`
- After completing consent, you return to Setup.

### 4) Select a Page → detect Instagram (if linked)

1. In Setup, select a Facebook Page from the Page list and confirm selection.

**Expected**:

- The selected Page is saved.
- If the Page has a linked Instagram Business account, Setup displays the detected Instagram username/ID (otherwise it shows a clear “not linked” style message).

### 5) Run a manual publish demonstration (Test Post)

1. Click **Send Test Post**.

**Expected (Option A: `META_PUBLISHING_ENABLED=true`)**:

- A test post is attempted to the selected Page (and to Instagram if detected/available).
- The UI shows success (and may show post IDs/permalinks depending on provider response).

**Expected (Option B: `META_PUBLISHING_ENABLED=false`)**:

- The publish action is intentionally blocked.
- The API returns a deterministic disabled response (see below).

---

## What reviewers should see (UI + API expectations)

### Setup UI states (high level)

- **Connected but missing publishing permissions**:
  - UI callout: “Publishing requires additional Meta permissions. Request Publishing Access.”
  - Missing permissions are listed in a stable order.
- **Publishing permissions granted**:
  - UI shows “Publishing permissions granted ✅”
  - Publishing actions remain disabled until `META_PUBLISHING_ENABLED=true` (intentional gating).

### Expected API results (deterministic)

#### Connection status

`GET /api/social-connections/meta/status`

- Includes:
  - `requiredScopesMissing: string[]` (stable order)
  - `nextSteps: string[]` (includes “Request Publishing Access” when missing `pages_manage_posts`)

Example when connected but missing publishing permissions:

```json
{
  "ok": true,
  "connected": true,
  "requiredScopesMissing": [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
    "instagram_basic",
    "instagram_content_publish"
  ],
  "nextSteps": ["Request Publishing Access"]
}
```

#### Start Publishing Access OAuth

`POST /api/social-connections/meta/request-publishing-access`

- On success: returns `{ ok:true, authUrl:"...", scopesRequested:[...] }` and the browser redirects to `authUrl`.
- If Meta env is missing: returns deterministic JSON with `code: "META_ENV_MISSING"`.

#### Manual Test Post guard behavior

`POST /api/social-connections/meta/test-post`

- If publishing is disabled by env:

```json
{ "ok": false, "code": "PUBLISHING_DISABLED" }
```

- If missing publishing scopes:

```json
{ "ok": false, "code": "MISSING_PUBLISHING_SCOPES", "missing": ["pages_manage_posts", "..."] }
```

---

## Manual publish only statement (for reviewers)

This integration **does not** publish in the background. There are **no background jobs** and **no unattended posting**. Posts are published only when an authenticated user explicitly initiates the action in the UI (e.g., “Send Test Post”).

