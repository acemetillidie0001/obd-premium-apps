# Event Campaign Builder — Master QA & Audit Runbook

This document is the master reference for the **Event Campaign Builder** app in the OBD Premium Apps suite.

It links together:

- Code & type contracts
- Frontend UX & layout
- Backend API & model behavior
- Component consistency with other V3 apps
- Automated/manual QA flows

Use this any time you:
- Onboard a new dev
- Make changes to the app
- Need to confirm it's still "production ready"

---

## 1. App Purpose & Scope

**Event Campaign Builder** converts local event details into a **multi-channel promotional campaign** for Ocala businesses.

Outputs can include:

- Event titles & descriptions (short + long)
- Facebook posts
- Instagram captions & story ideas
- X (Twitter) posts
- Google Business posts
- Email announcement (subject, preview, body text + HTML)
- SMS mini-blasts
- Image caption / poster text
- Hashtag bundles
- Suggested posting schedule

Inputs cover:

- Business basics (name, type, services, location)
- Event details (name, date, time, location, type, description)
- Strategy (audience, goal, urgency, campaign duration)
- Brand voice & personality
- Language (English, Spanish, Bilingual)
- Channel toggles (Facebook, Instagram, X, GBP, Email, SMS, Image Caption)
- Notes to the AI

---

## 2. Key Files

**Frontend & Types**

- `src/app/apps/event-campaign-builder/page.tsx`  
  Main V3-style UI: form, submit handler, results cards, copy buttons.

- `src/app/apps/event-campaign-builder/types.ts`  
  Type contracts:
  - `EventCampaignFormValues`
  - `EventCampaignResponse`
  - `EventGoal`, `EventType`, `PersonalityStyle`, `LanguageOption`
  - `EmailAnnouncement`, `HashtagBundle`, `ScheduleIdea`, `EventCampaignAssets`, `EventCampaignMeta`

**Backend**

- `src/app/api/event-campaign-builder/route.ts`  
  - Validates request (Zod)  
  - Normalizes values (Ocala defaults, duration clamping)  
  - Calls OpenAI (`gpt-4o-mini`) with strict JSON-only system prompt  
  - Parses & validates response (Zod)  
  - Enforces channel toggles on final output  
  - Returns `{ ok: boolean; data?: EventCampaignResponse; error?: string }`

**Config / Integration**

- `src/lib/obd-framework/apps.config.ts` (or equivalent)  
  - Registers the app in the Premium Apps grid  
  - `id` / `slug`: `"event-campaign-builder"`  
  - `href`: `"/apps/event-campaign-builder"`  
  - `status`: `"live"`  
  - `category`: `"content"` (or your chosen category)  
  - `ctaLabel`: `"Create Campaign"`

**QA & Audit Docs**

- `tests/api/event-campaign-builder.http`  
  Manual API test scenarios (REST Client / Thunder Client / Postman).

- `tests/api/event-campaign-builder-qa.md`  
  Detailed API QA checklist (status codes, toggles, language behavior).

- `docs/apps/event-campaign-builder-audit.md`  
  Complete end-to-end audit (design, frontend, backend, integration).

- `docs/apps/event-campaign-builder-consistency-audit.md`  
  Component usage alignment with V3 design system.

- `docs/apps/event-campaign-builder-ux-copy-polish-summary.md`  
  UX copy / microcopy audit and final polished text.

---

## 3. Quick "Is It Alive?" Checklist

Before doing deeper changes, verify:

1. **Navigation**
   - The app appears in the Premium Apps list.
   - Clicking the tile goes to `/apps/event-campaign-builder`.

2. **UI Loads**
   - Page title: "Event Campaign Builder"
   - Tagline referencing converting Ocala event details into ready-to-post campaigns.
   - Form + results area rendered without console errors.

3. **Form Defaults**
   - `city` = `"Ocala"`
   - `state` = `"Florida"`
   - `personalityStyle` = `"None"`
   - `language` = `"English"`
   - `campaignDurationDays` = `10`
   - Facebook / Instagram / Google Business toggles ON by default.

4. **Happy-Path Run**
   - Fill in realistic event details.
   - Submit → see loading → then result cards (overview, titles, descriptions, social, email, SMS, hashtags, schedule).
   - Copy buttons show "Copied!" feedback.

If all of the above are true, you're in good shape.

---

## 4. API Test Suite (Manual / REST Client)

Use:

- `tests/api/event-campaign-builder.http`
- `tests/api/event-campaign-builder-qa.md`

Core scenarios covered:

1. **Baseline Happy Path**
   - English, all channels ON.
   - Expect full `EventCampaignResponse` with email, SMS, image caption, social posts, hashtags, schedule.

2. **Validation Errors**
   - Missing `eventName` or other required fields.
   - Expect 400, `ok: false`, and `debug.issues` in dev.

3. **Channel Toggles OFF**
   - All toggles false.
   - Expect core content only (titles, descriptions, hashtags, schedule).
   - Social/email/SMS/image arrays empty or null.

4. **Language Variants**
   - Spanish-only: content in Spanish.
   - Bilingual: `English: ...` + `Español: ...` format for major fields.

5. **Last-Minute Campaign**
   - `urgencyLevel = "Last-Minute"`, short `campaignDurationDays`.
   - Expect tight timeline and urgent but non-spammy copy.

6. **Duration Clamping**
   - `campaignDurationDays` too low (0) or too high (100).
   - Should be normalized to safe range (e.g. 3–30) by `normalizeFormValues`.

Run these after any backend/system prompt changes.

---

## 5. Design & Layout Audits

For visual consistency, consult:

- `docs/apps/event-campaign-builder-audit.md` (Section 3: Frontend UI & UX Audit)

High-level design expectations:

- Uses the same V3 layout as:
  - Offers & Promotions Builder
  - AI Image Caption Generator
- Clear section grouping:
  - Business Basics
  - Event Details
  - Strategy
  - Brand & Style
  - Channels
  - Campaign Settings
- Consistent spacing and typography with other V3 apps.
- Responsive:
  - Stacked layout on mobile.
  - Cards full-width on small screens, grid on desktop.
- Sticky bottom action bar matches other apps' behavior.

Whenever you adjust UI structure, re-run the design audit to keep it in sync.

---

## 6. Component Consistency

For design system alignment, consult:

- `docs/apps/event-campaign-builder-consistency-audit.md`

Key rules:

- Reuse shared components:
  - Layout containers (`OBDPageContainer`, `OBDPanel`, `OBDHeading`)
  - Result cards (`ResultCard` from `@/components/obd/ResultCard`)
  - Theme utilities (`getThemeClasses`, `getInputClasses`)
  - Layout helpers (`SUBMIT_BUTTON_CLASSES`, `getErrorPanelClasses`, `getDividerClass`)
- Avoid introducing one-off UI/logic where a shared component already exists.
- Keep imports aligned with other V3 apps (no weird internal path reaches).

If Event Campaign Builder starts diverging from newer apps' patterns, plan a small refactor to realign.

---

## 7. UX Copy & Microcopy

For tone and wording:

- Use the UX copy spec in:
  - `docs/apps/event-campaign-builder-ux-copy-polish-summary.md`

Guidelines:

- Tone: friendly, clear, local, professional.
- Use sentence case for labels and headings.
- Helper text should be one line, specific, and non-technical.
- Error messages: direct and human:
  - "Please enter an event name."
  - "Please enter an event location."
- Error + "something went wrong" messages:
  - "Something went wrong while generating your campaign. Please try again."

---

## 8. When You Make Changes

Whenever you:

- Change the system prompt
- Change the types
- Change the UI structure
- Add/remove channels or fields

You should:

1. **Update Types**
   - `EventCampaignFormValues`
   - `EventCampaignResponse`
   - Zod schemas in `route.ts`

2. **Update Form**
   - Add/remove inputs in `page.tsx`.
   - Ensure defaults and validation match the types.

3. **Update Prompt**
   - Make sure the SYSTEM_PROMPT input/output contract is up to date.

4. **Re-run QA**
   - Re-run all `.http` scenarios.
   - Quick UI smoke check.
   - If relevant, refresh design/consistency/copy audits.

5. **Update This Doc**
   - Add a short "Changelog" entry.

---

## 8.5. OBD CRM Integration

**Status: Not applicable yet**

The Event Campaign Builder currently does not capture or store person-level attendee/recipient information (name, email, phone). The app generates marketing content templates (social posts, email templates, SMS templates, etc.) but does not have functionality to:

- Add or manage attendee lists
- Send invites to recipients
- Store recipient contact information
- Track RSVPs or ticket sales

As such, CRM integration with OBD CRM is **not applicable at this time**. If person-level attendee/recipient functionality is added in the future, CRM integration can be implemented at that point to:

- Upsert contacts when attendees/recipients are added
- Add activity notes when invites are sent
- Tag contacts with event campaign information

---

## 9. Changelog (high-level)

_Add entries here when significant changes are made._

- **v1.0** — Initial V3 implementation + full QA suite + design/consistency/copy audits wired.
- **v1.1** — Extracted `ResultCard` to shared component (`@/components/obd/ResultCard`), updated Event Campaign Builder to use shared component.
- **v1.2** — Visual & UX enhancements:
  - Added animated loading spinner with progress message
  - Enhanced empty state with icon and clearer messaging
  - Added success toast notification on campaign generation
  - Converted channel selection to card-based grid UI
  - Added character counters to long text inputs (Event Description, Brand Voice, Additional Notes)
  - Enabled `response_format: json_object` in backend for stricter JSON output
- _Add future entries below…_
