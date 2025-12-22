# Event Campaign Builder — API QA Guide

This guide helps you smoke-test the `Event Campaign Builder` API endpoint:

- **Endpoint:** `POST /api/event-campaign-builder`
- **Request type:** `EventCampaignFormValues` (JSON)
- **Response wrapper:** `{ ok: boolean; data?: EventCampaignResponse; error?: string }`

The goal is to confirm:

1. Validation works (bad input → clean 400 errors).
2. The OpenAI integration returns structured JSON.
3. Channel toggles are respected.
4. Language and personality logic behave correctly.
5. The app is safe to use for real Ocala businesses.

---

## How to Run the `.http` Tests

### VS Code REST Client

1. Install the extension: **"REST Client"** by Huachao Mao.
2. Open `tests/api/event-campaign-builder.http`.
3. Make sure your dev server is running (usually `http://localhost:3000`).
4. Above each `POST` block, you'll see a `Send Request` link.
5. Click `Send Request` for each scenario and inspect the response in the side panel.

### Thunder Client / Postman / Insomnia

1. Copy the JSON body from a scenario.
2. Set method to `POST`.
3. URL: `http://localhost:3000/api/event-campaign-builder`.
4. Add header: `Content-Type: application/json`.
5. Paste the JSON body and send the request.
6. Compare the response against the expectations below.

---

## General Expectations

For **successful** requests:

```json
{
  "ok": true,
  "data": {
    "meta": { ... },
    "assets": { ... }
  }
}
```

For validation or server errors:

```json
{
  "ok": false,
  "error": "Human-readable error message",
  "debug": { ... } // only in development
}
```

In development, `debug` may contain Zod validation details or raw model content. In production, it should not leak internals.

---

## Scenario Checklist

Use this list while running the `.http` file.

### 1. Baseline Happy Path (English, all channels ON)

✅ Status is `200`.  
✅ `ok: true`.  
✅ `meta.primaryTagline`, `primaryCallToAction`, `recommendedStartDateNote`, `timezoneNote` are non-empty.  
✅ `assets.eventTitles`, `shortDescriptions`, `facebookPosts`, `instagramCaptions`, `instagramStoryIdeas`, `xPosts`, `googleBusinessPosts` are arrays with at least 1 item.  
✅ `emailAnnouncement` is present and not null.  
✅ `smsBlasts` has at least 1 item.  
✅ `imageCaption` is not null.  
✅ No markdown fences or stray text: response is pure JSON.

---

### 2. Required Field Validation (Missing eventName)

✅ Status is `400`.  
✅ `ok: false`.  
✅ `error` is a human-readable message (e.g., "Please fix the highlighted form errors.").  
✅ In dev, `debug.issues` includes an error for `eventName` (and possibly other fields like `eventDescription`).

This confirms server-side Zod validation is wired correctly.

---

### 3. All Channel Toggles OFF

✅ Status is `200`, `ok: true`.  
✅ `facebookPosts`, `instagramCaptions`, `instagramStoryIdeas`, `xPosts`, `googleBusinessPosts` are all empty arrays `[]`.  
✅ `emailAnnouncement` is `null`.  
✅ `smsBlasts` is `[]` (or `null` depending on schema + model).  
✅ `imageCaption` is `null`.  
✅ Still populated:
- `eventTitles`
- `shortDescriptions`
- `longDescription`
- `hashtagBundles`
- `scheduleIdeas`

This verifies the post-response enforcement logic in `route.ts` is working.

---

### 4. Spanish-only Event (language = Spanish)

✅ Status `200`, `ok: true`.  
✅ Major text fields (titles, descriptions, posts, email, SMS) are in Spanish.  
✅ Only proper nouns like business name or "Ocala" are in English.  
✅ Tone is warm and family-friendly (matches `Soft` style + `brandVoice`).

---

### 5. Bilingual Event (language = Bilingual)

✅ Status `200`, `ok: true`.  
✅ In major text fields (titles, descriptions, posts, email, SMS) you see both languages in a clear pattern, like:

```
English: ...
Español: ...
```

✅ No messy alternation of English and Spanish mid-sentence.  
✅ Hashtags are mostly English with some Spanish mixed in (this is acceptable).

---

### 6. Last-Minute Campaign (urgency = Last-Minute)

✅ Status `200`, `ok: true`.  
✅ `meta.recommendedStartDateNote` references a short promotion window, not "start 30 days in advance".  
✅ `scheduleIdeas` focuses on a tight timeframe:
- `dayOffset` values like `3`, `2`, `1`, `0`.  
✅ The tone is gently urgent but not panicked or spammy.

---

### 7. campaignDurationDays Clamping (0 and 100)

✅ Both requests return `200`, `ok: true`.  
✅ No validation errors for `campaignDurationDays` despite out-of-range values.  
✅ In dev, if you temporarily `console.log` the normalized values, you should see:
- `0` → clamped up to the minimum (e.g. `3`)
- `100` → clamped down to the maximum (e.g. `30`)  
✅ Model recommendations in `recommendedStartDateNote` should still sound reasonable.

---

## UI-Level Smoke Tests

After confirming API behavior, run a quick UI pass:

1. Open `/apps/event-campaign-builder` in the dashboard.

2. Confirm:
   - Title: **Event Campaign Builder**
   - Tagline/description matches the "Ocala event campaign" positioning.
   - The app tile appears in the Premium Apps list with:
     - Status: `live`
     - CTA: "Create Campaign"

3. With empty form, click **Generate Campaign**:
   - Required fields highlight or show inline errors.

4. Fill in the form using values from **Scenario 1**:
   - Submit once.
   - Confirm:
     - Result cards render for Overview, Titles, Descriptions, Social, Email, SMS, Hashtags, Schedule.
     - Copy buttons show a "Copied!" confirmation.
     - Sticky bottom bar (Regenerate / Start New) behaves correctly.

5. Toggle off all channels except one (e.g., only Instagram on):
   - Regenerate.
   - Confirm only that channel's cards are populated.

---

## Troubleshooting

If something fails:

**400 with validation issues**
- Check the request body matches `EventCampaignFormValues`.
- Look at `debug.issues` in dev to see which field is invalid.

**500 with parse/format error**
- Look at `debug.parseError` or `debug.validationIssues` if available.
- Confirm `SYSTEM_PROMPT` still instructs the model to output JSON only, no markdown.

**Weird language mixing (Bilingual)**
- Tighten the instruction in `SYSTEM_PROMPT` around bilingual format.
- Emphasize: "Always format as 'English: ...\nEspañol: ...' for major text fields."

---

Once all scenarios pass consistently, the Event Campaign Builder API can be treated as **production-ready** for OBD Premium Apps.
