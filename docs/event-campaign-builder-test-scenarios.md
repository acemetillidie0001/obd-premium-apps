# Event Campaign Builder — Test Scenarios

## 1️⃣ Quick Smoke Checklist (UI-level)

### Visual Verification
- [ ] Open `/apps/event-campaign-builder`
- [ ] Page title: "Event Campaign Builder"
- [ ] Tagline: "Turn your Ocala event details into a complete, ready-to-post promo campaign in minutes."
- [ ] App appears in Premium Apps list with:
  - Status: `live`
  - Icon: correct
  - CTA: "Create Campaign"

### Default Values Check
- [ ] `city` = "Ocala"
- [ ] `state` = "Florida"
- [ ] `personalityStyle` = "None"
- [ ] `language` = "English"
- [ ] `campaignDurationDays` = 10
- [ ] Facebook toggle: ON
- [ ] Instagram toggle: ON
- [ ] Google Business toggle: ON
- [ ] X toggle: OFF
- [ ] Email toggle: OFF
- [ ] SMS toggle: OFF
- [ ] Image Caption toggle: OFF

### Validation Testing
- [ ] Submit with all fields blank → Should show validation errors for:
  - `businessName` (required)
  - `businessType` (required)
  - `eventName` (required)
  - `eventDate` (required)
  - `eventTime` (required)
  - `eventLocation` (required)
  - `eventDescription` (required)

### Full Form Submission
- [ ] Fill all fields with realistic values
- [ ] Submit form
- [ ] Loading state appears
- [ ] On success, cards render in order:
  1. Campaign Overview
  2. Event Titles
  3. Short Descriptions
  4. Long Description
  5. Social Posts (Facebook, Instagram, X, Google Business)
  6. Instagram Story Ideas
  7. Email Announcement
  8. SMS Blasts
  9. Image Caption
  10. Hashtag Bundles
  11. Schedule Ideas
- [ ] Copy buttons show "Copied!" feedback

---

## 2️⃣ API Test Scenarios

### Scenario 1 — Baseline Happy Path (English, all channels ON)

**Goal:** Confirm full pipeline works and returns valid `EventCampaignResponse`.

**Request:**
```json
{
  "businessName": "Sunrise Wellness Spa",
  "businessType": "Day Spa",
  "services": "Massages, facials, aromatherapy, couples packages",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "Relax & Reset Ladies Night",
  "eventDate": "March 15, 2026",
  "eventTime": "6:00 PM – 8:30 PM",
  "eventLocation": "Sunrise Wellness Spa, Ocala, FL",
  "eventType": "InPerson",
  "eventDescription": "An intimate after-hours spa event with mini-massages, skincare demos, aromatherapy, refreshments, and exclusive discounts on packages.",
  "audience": "Women in Ocala who want to de-stress and enjoy a self-care evening with friends.",
  "mainGoal": "RSVPs",
  "budgetLevel": "Moderate",
  "urgencyLevel": "Normal",
  "brandVoice": "Gentle, caring, and community-centered.",
  "personalityStyle": "Soft",
  "language": "English",
  "includeFacebook": true,
  "includeInstagram": true,
  "includeX": true,
  "includeGoogleBusiness": true,
  "includeEmail": true,
  "includeSms": true,
  "includeImageCaption": true,
  "campaignDurationDays": 10,
  "notesForAI": "Limited spots available, but keep the tone soft and not pushy."
}
```

**Verify:**
- [ ] HTTP status: `200`
- [ ] Response shape: `{ "ok": true, "data": { "meta": {...}, "assets": {...} } }`
- [ ] `meta` fields exist and are non-empty strings
- [ ] `assets.eventTitles` array length ≥ 1
- [ ] `assets.shortDescriptions` array length ≥ 1
- [ ] `assets.facebookPosts` array length ≥ 1
- [ ] `assets.instagramCaptions` array length ≥ 1
- [ ] `assets.instagramStoryIdeas` array length ≥ 1
- [ ] `assets.xPosts` array length ≥ 1
- [ ] `assets.googleBusinessPosts` array length ≥ 1
- [ ] `assets.emailAnnouncement` is present and not null
- [ ] `assets.smsBlasts` is present and has length ≥ 1
- [ ] `assets.imageCaption` is non-null
- [ ] No markdown wrapper or extraneous text—pure JSON

---

### Scenario 2 — Required Field Validation (Missing eventName)

**Goal:** Ensure server-side validation catches missing required fields.

**Request:**
```json
{
  "businessName": "Sunrise Wellness Spa",
  "businessType": "Day Spa",
  "services": "",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "",
  "eventDate": "March 15, 2026",
  "eventTime": "6:00 PM – 8:30 PM",
  "eventLocation": "Sunrise Wellness Spa, Ocala, FL",
  "eventType": "InPerson",
  "eventDescription": "Short.",
  "audience": "",
  "mainGoal": "RSVPs",
  "budgetLevel": "Low",
  "urgencyLevel": "Normal",
  "brandVoice": "",
  "personalityStyle": "None",
  "language": "English",
  "includeFacebook": true,
  "includeInstagram": true,
  "includeX": true,
  "includeGoogleBusiness": true,
  "includeEmail": true,
  "includeSms": true,
  "includeImageCaption": true,
  "campaignDurationDays": 10,
  "notesForAI": ""
}
```

**Verify:**
- [ ] HTTP status: `400`
- [ ] Response shape: `{ "ok": false, "error": "Please fix the highlighted form errors.", "debug": { "issues": {...} } }`
- [ ] In dev mode, `debug.issues` shows `eventName` validation error
- [ ] `debug.issues` may also show `eventDescription` validation error (min 10 chars)

---

### Scenario 3 — Channel Toggles OFF (No social, email, SMS, image)

**Goal:** Confirm output is hard-filtered by toggles in route.ts.

**Request:**
```json
{
  "businessName": "Brick City Fitness",
  "businessType": "Gym",
  "services": "Group classes, personal training, open gym",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "Spring Fitness Kickoff",
  "eventDate": "April 5, 2026",
  "eventTime": "9:00 AM – 12:00 PM",
  "eventLocation": "Brick City Fitness, Ocala, FL",
  "eventType": "InPerson",
  "eventDescription": "A free community fitness morning with sample classes, demos, and Q&A with trainers.",
  "audience": "Adults in Ocala interested in trying a new gym or getting back into a routine.",
  "mainGoal": "Leads",
  "budgetLevel": "Free",
  "urgencyLevel": "Normal",
  "brandVoice": "Energetic but approachable.",
  "personalityStyle": "High-Energy",
  "language": "English",
  "includeFacebook": false,
  "includeInstagram": false,
  "includeX": false,
  "includeGoogleBusiness": false,
  "includeEmail": false,
  "includeSms": false,
  "includeImageCaption": false,
  "campaignDurationDays": 7,
  "notesForAI": "We only want text assets for internal planning in this test."
}
```

**Verify:**
- [ ] HTTP status: `200`
- [ ] `ok: true`
- [ ] `data.assets.facebookPosts` is `[]`
- [ ] `data.assets.instagramCaptions` is `[]`
- [ ] `data.assets.instagramStoryIdeas` is `[]`
- [ ] `data.assets.xPosts` is `[]`
- [ ] `data.assets.googleBusinessPosts` is `[]`
- [ ] `data.assets.emailAnnouncement` is `null`
- [ ] `data.assets.smsBlasts` is `[]` or `null`
- [ ] `data.assets.imageCaption` is `null`
- [ ] Still present and non-empty:
  - [ ] `eventTitles`
  - [ ] `shortDescriptions`
  - [ ] `longDescription`
  - [ ] `hashtagBundles`
  - [ ] `scheduleIdeas`

---

### Scenario 4 — Spanish-only Event (Language = Spanish)

**Goal:** Confirm language switch works and everything comes back in Spanish.

**Request:**
```json
{
  "businessName": "Casa Verde Restaurante",
  "businessType": "Restaurant",
  "services": "Comida latina, cenas familiares, eventos especiales",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "Noche de Sabores Latinos",
  "eventDate": "May 10, 2026",
  "eventTime": "7:00 PM – 10:00 PM",
  "eventLocation": "Casa Verde Restaurante, Ocala, FL",
  "eventType": "InPerson",
  "eventDescription": "Una noche especial con platillos latinos, música suave y degustaciones de la casa.",
  "audience": "Familias y amigos que disfrutan de la comida latina en Ocala.",
  "mainGoal": "RSVPs",
  "budgetLevel": "Moderate",
  "urgencyLevel": "Normal",
  "brandVoice": "Cálido, acogedor y familiar.",
  "personalityStyle": "Soft",
  "language": "Spanish",
  "includeFacebook": true,
  "includeInstagram": true,
  "includeX": true,
  "includeGoogleBusiness": true,
  "includeEmail": true,
  "includeSms": true,
  "includeImageCaption": true,
  "campaignDurationDays": 14,
  "notesForAI": "Mantén el tono familiar y acogedor. No exageres con mayúsculas ni signos de exclamación."
}
```

**Verify:**
- [ ] All major fields (titles, descriptions, posts, email, SMS) are in Spanish
- [ ] No random English sentences (except proper nouns like restaurant name, city)
- [ ] Tone is warm, family-friendly
- [ ] Content reads naturally in Spanish (not word-for-word translations)

---

### Scenario 5 — Bilingual Mode (English + Spanish)

**Goal:** Confirm bilingual format logic: `English: ... \nEspañol: ...`

**Request:**
```json
{
  "businessName": "Ocala Art Collective",
  "businessType": "Art Gallery",
  "services": "Local art exhibits, workshops, live art events",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "First Friday Art Walk",
  "eventDate": "June 5, 2026",
  "eventTime": "5:00 PM – 8:00 PM",
  "eventLocation": "Downtown Ocala, various galleries",
  "eventType": "InPerson",
  "eventDescription": "A downtown art walk with local artists, live demos, and gallery open houses.",
  "audience": "Locals and visitors who enjoy art, culture, and community events.",
  "mainGoal": "Awareness",
  "budgetLevel": "Low",
  "urgencyLevel": "Normal",
  "brandVoice": "Creative, welcoming, and community-focused.",
  "personalityStyle": "Bold",
  "language": "Bilingual",
  "includeFacebook": true,
  "includeInstagram": true,
  "includeX": true,
  "includeGoogleBusiness": true,
  "includeEmail": true,
  "includeSms": true,
  "includeImageCaption": true,
  "campaignDurationDays": 12,
  "notesForAI": "Please clearly separate English and Spanish like 'English: ...\\nEspañol: ...'."
}
```

**Verify:**
- [ ] In major fields (titles, descriptions, posts, email):
  - [ ] Pattern: `English: ...` then `Español: ...` (or similar clear separation)
  - [ ] No messy intermixing (English + Spanish alternating mid-sentence)
- [ ] Hashtags may be mostly English with some Spanish; that's acceptable

---

### Scenario 6 — Urgency = Last-Minute + Short Duration

**Goal:** Ensure `meta.recommendedStartDateNote` and schedule ideas respect a last-minute push.

**Request:**
```json
{
  "businessName": "Downtown Yoga Studio",
  "businessType": "Fitness Studio",
  "services": "Yoga classes, workshops, private sessions",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "Sunday Sunrise Rooftop Yoga",
  "eventDate": "July 12, 2026",
  "eventTime": "7:00 AM – 8:00 AM",
  "eventLocation": "Rooftop, Downtown Ocala",
  "eventType": "InPerson",
  "eventDescription": "A one-hour sunrise yoga session on a downtown rooftop with gentle flows and guided breathing.",
  "audience": "Adults who want a calm, early-morning reset.",
  "mainGoal": "RSVPs",
  "budgetLevel": "Low",
  "urgencyLevel": "Last-Minute",
  "brandVoice": "Calm, encouraging, and minimalistic.",
  "personalityStyle": "Soft",
  "language": "English",
  "includeFacebook": true,
  "includeInstagram": true,
  "includeX": true,
  "includeGoogleBusiness": true,
  "includeEmail": true,
  "includeSms": true,
  "includeImageCaption": true,
  "campaignDurationDays": 3,
  "notesForAI": "Focus on a short last-minute push without sounding panicked."
}
```

**Verify:**
- [ ] `meta.recommendedStartDateNote` mentions something like "3 days" or last-minute timing
- [ ] `scheduleIdeas` include `dayOffset` values like 3, 2, 1, 0 (tight window)
- [ ] Copy doesn't sound desperate, just gently urgent
- [ ] Posts may include urgency language like "Last chance", "Happening soon", "Only X days left"

---

### Scenario 7 — campaignDurationDays Out of Range (Clamping)

**Goal:** Confirm normalization function clamps values to 3–30.

**Request A (too low):**
```json
{
  "businessName": "Ocala Coding Camp",
  "businessType": "Education",
  "services": "Kids coding camps, STEM workshops",
  "city": "Ocala",
  "state": "Florida",
  "eventName": "Weekend Coding Camp",
  "eventDate": "August 22, 2026",
  "eventTime": "9:00 AM – 3:00 PM",
  "eventLocation": "Ocala Innovation Center",
  "eventType": "InPerson",
  "eventDescription": "A 1-day kids coding camp introducing basic game design and logic.",
  "audience": "Parents of kids ages 8–13 in Ocala.",
  "mainGoal": "TicketSales",
  "budgetLevel": "Premium",
  "urgencyLevel": "Normal",
  "brandVoice": "Friendly, educational, and empowering.",
  "personalityStyle": "High-Energy",
  "language": "English",
  "includeFacebook": true,
  "includeInstagram": true,
  "includeX": true,
  "includeGoogleBusiness": true,
  "includeEmail": true,
  "includeSms": true,
  "includeImageCaption": true,
  "campaignDurationDays": 0,
  "notesForAI": ""
}
```

**Request B (too high):** Same as above but `"campaignDurationDays": 100`

**Verify:**
- [ ] HTTP status: `200` (no errors thrown)
- [ ] In dev logs or by temporarily logging normalized form, duration should be clamped:
  - Request A: `0` → normalized to `3`
  - Request B: `100` → normalized to `30`
- [ ] Generated `scheduleIdeas` reflect the clamped duration, not the original value

---

### Scenario 8 — Big Text / Stress Test

**Goal:** Ensure the route handles longer brand voice, notes, and description without timing out or failing.

**Request:** Take Scenario 1 and expand:
- `brandVoice`: Add a long paragraph (200+ words)
- `notesForAI`: Add multiple bullet points in one string (300+ words)
- `eventDescription`: Expand to 3–4 detailed sentences

**Verify:**
- [ ] HTTP status: `200`
- [ ] No JSON parsing errors
- [ ] Generated text stays reasonably concise (the prompt rules should prevent insane bloat)
- [ ] Response time is acceptable (< 10 seconds)
- [ ] All required fields are still present and valid

---

## Test Execution Notes

### Using VS Code REST Client

Create a file `test-api.http`:

```http
### Scenario 1: Baseline Happy Path
POST http://localhost:3000/api/event-campaign-builder
Content-Type: application/json

{
  "businessName": "Sunrise Wellness Spa",
  ...
}
```

### Using cURL

```bash
curl -X POST http://localhost:3000/api/event-campaign-builder \
  -H "Content-Type: application/json" \
  -d @scenario1.json
```

### Using Postman/Thunder Client

1. Create a new POST request
2. URL: `http://localhost:3000/api/event-campaign-builder`
3. Headers: `Content-Type: application/json`
4. Body: Copy the JSON from each scenario above

---

## Expected Response Times

- Simple requests (all channels ON): ~3-5 seconds
- Complex requests (bilingual, long text): ~5-8 seconds
- Stress test: ~8-12 seconds

If responses take longer than 15 seconds, investigate:
- OpenAI API latency
- Network issues
- Token limits being hit

---

## Common Issues to Watch For

1. **JSON parsing errors**: Check if AI response is wrapped in markdown
2. **Missing fields**: Verify all required fields in `EventCampaignResponse` are present
3. **Empty arrays when channels are ON**: Check channel toggle enforcement logic
4. **Language mixing**: In bilingual mode, ensure clear separation
5. **Validation bypass**: Ensure Zod schemas catch all required fields
6. **Duration clamping**: Verify `normalizeFormValues` is working correctly
