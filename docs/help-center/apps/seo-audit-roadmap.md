# SEO Audit & Roadmap

## What this app IS

- A deterministic, single-page SEO audit tool that scores a page across fixed categories (0/5/10 points each).
- A roadmap generator that prioritizes improvements (HIGH/MEDIUM/OPTIONAL) with clear explanations.
- A hardened page-fetch tool (SSRF protections, redirects validation, timeouts, size limits, HTML-only).

## What this app is NOT

- Not a site-wide crawler (single-page only).
- Not an AI tool (rule-based scoring; no AI suggestions).
- Not a publisher or site editor (no website changes).

## What you typically get (outputs)

- A 0–100 score composed from 10 deterministic categories.
- A prioritized roadmap of fixes with “why it matters” and “what to do”.
- Related app links for next steps (navigation only).

## Draft & export behavior

- Results are **advisory-only** and do not change your site.
- Outputs can be copied for reference (score summary / roadmap text), depending on UI controls.
- No “apply” or “publish” actions exist in this app’s core audit flow.

## Integrations & boundaries

- Related app links are **navigation only** (no automatic handoff).
- URL inputs are validated defensively to prevent SSRF and non-HTML processing.
- Authentication is enforced in the app/API (production behavior is protected).

## Common questions

- **Does this crawl my whole site?** No—single-page only.
- **Does it browse the web?** No—only fetches the specific page you provide (HTML-only).
- **Is the score deterministic?** Yes—same input yields the same score.
- **Will it fix my page automatically?** No—advisory-only.
- **Why might a score differ across runs?** If the page HTML changed (or the URL fetch returned different HTML).
- **Can I audit pasted HTML?** Yes (supported by the tool’s design).

