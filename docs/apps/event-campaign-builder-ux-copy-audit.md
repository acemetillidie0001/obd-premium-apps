# Event Campaign Builder — UX Copy Audit & Polish

**Date**: Current  
**Auditor**: Senior UX Writer & Product Designer  
**Status**: In Progress

---

## 1. CURRENT COPY INVENTORY

| Location | Current Copy | Notes |
|---------|--------------|-------|
| **Page Header** |
| Page Title | "Event Campaign Builder" | OBDPageContainer title prop |
| Tagline | "Turn your Ocala event details into a complete, ready-to-post promo campaign in minutes." | OBDPageContainer tagline prop |
| **Form Section Headings** |
| Section 1 | "Business Basics" | OBDHeading level={2} |
| Section 2 | "Event Core Details" | OBDHeading level={2} |
| Section 3 | "Strategy" | OBDHeading level={2} |
| Section 4 | "Brand & Style" | OBDHeading level={2} |
| Section 5 | "Channels" | OBDHeading level={2} |
| Section 6 | "Extra Options" | OBDHeading level={2} |
| **Form Labels** |
| Business Name | "Business Name *" | Required field |
| Business Type | "Business Type *" | Required field |
| Services | "Services (Optional)" | Optional field |
| City | "City" | No asterisk |
| State | "State" | No asterisk |
| Event Name | "Event Name *" | Required field |
| Event Date | "Event Date *" | Required field |
| Event Time | "Event Time *" | Required field |
| Event Location | "Event Location *" | Required field |
| Event Type | "Event Type" | Select dropdown |
| Event Description | "Event Description *" | Required textarea |
| Target Audience | "Target Audience" | Optional input |
| Main Goal | "Main Goal" | Select dropdown |
| Budget Level | "Budget Level" | Select dropdown |
| Urgency Level | "Urgency Level" | Select dropdown |
| Brand Voice | "Brand Voice (Optional)" | Optional textarea |
| Personality Style | "Personality Style" | Select dropdown |
| Language | "Language" | Select dropdown |
| Campaign Duration | "Campaign Duration (Days)" | Number input |
| Additional Notes | "Additional Notes for AI (Optional)" | Optional textarea |
| **Placeholders** |
| Business Name | "e.g., Ocala Coffee Shop" | Example format |
| Business Type | "e.g., Restaurant, Retail, Service" | Example format |
| Services | "Comma-separated: e.g., Pressure washing, Driveway cleaning" | Instruction + example |
| City | "Ocala" | Default value hint |
| State | "Florida" | Default value hint |
| Event Name | "e.g., Spring Open House" | Example format |
| Event Date | "e.g., March 15, 2026 or 2026-03-15" | Example formats |
| Event Time | "e.g., 6:00 PM – 9:00 PM" | Example format |
| Event Location | "e.g., 123 Main St, Ocala, FL or Zoom link" | Example formats |
| Event Description | "Describe what's happening, key details, what attendees can expect..." | Instructional |
| Target Audience | "e.g., Local families, horse owners, small business owners" | Example format |
| Brand Voice | "Paste 2–4 sentences that sound like your existing brand voice" | Instructional |
| Additional Notes | "Any special instructions, tone preferences, or context..." | Instructional |
| **Helper Text** |
| Campaign Duration | "How many days before the event should the campaign start? (3–30 days)" | Helper text below input |
| **Checkbox Labels** |
| Facebook | "📘 Facebook" | Channel checkbox |
| Instagram | "📸 Instagram" | Channel checkbox |
| X | "✖️ X (Twitter)" | Channel checkbox |
| Google Business | "📍 Google Business Profile" | Channel checkbox |
| Email | "📧 Email Announcement" | Channel checkbox |
| SMS | "💬 SMS Blasts" | Channel checkbox |
| Image Caption | "🖼️ Image Caption" | Channel checkbox |
| **Button Labels** |
| Submit (idle) | "Generate Event Campaign" | Primary CTA |
| Submit (loading) | "Generating Campaign..." | Loading state |
| Regenerate | "Regenerate with Same Inputs" | Secondary action |
| Start New | "Start New Campaign" | Primary action in sticky bar |
| Copy Button (idle) | "Copy" | Copy-to-clipboard |
| Copy Button (copied) | "Copied!" | Success feedback |
| **Error Messages** |
| Business Name Required | "Business name is required." | Validation error |
| Business Type Required | "Business type is required." | Validation error |
| Event Name Required | "Event name is required." | Validation error |
| Event Description Required | "Event description is required." | Validation error |
| Event Date Required | "Event date is required." | Validation error |
| Event Time Required | "Event time is required." | Validation error |
| Event Location Required | "Event location is required." | Validation error |
| No Channels Selected | "At least one channel must be selected." | Validation error |
| Generic Error | "An error occurred while generating your event campaign. Please try again." | Fallback error |
| **Result Section Headings** |
| Results Header | "Generated Event Campaign" | OBDHeading level={2} |
| Campaign Overview | "Campaign Overview" | h3 heading |
| Social Media Posts | "Social Media Posts" | h3 heading |
| Hashtag Bundles | "Hashtag Bundles" | h3 heading |
| Campaign Schedule | "Campaign Schedule Ideas" | h3 heading |
| **Result Card Titles** |
| Campaign Overview | "" (empty title) | No title, just content |
| Event Titles | "Event Title Options" | Card title |
| Short Descriptions | "Short Descriptions" | Card title |
| Long Description | "Long Description" | Card title |
| Facebook Post | "📘 Facebook" | Card title |
| Instagram Caption | "📸 Instagram Caption" | Card title |
| X Post | "✖️ X (Twitter)" | Card title |
| Google Business Post | "📍 Google Business Profile" | Card title |
| Instagram Stories | "📸 Instagram Story Ideas" | Card title |
| Email Announcement | "📧 Email Announcement" | Card title |
| SMS Blasts | "💬 SMS Blasts" | Card title |
| Image Caption | "🖼️ Image Caption" | Card title |
| Hashtag Bundle | "{platform} Hashtags" | Dynamic title |
| Schedule Ideas | "" (empty title) | No title |
| **Result Card Subtitles** |
| Primary Tagline | "Primary Tagline" | Uppercase label |
| Primary Call to Action | "Primary Call to Action" | Uppercase label |
| Recommended Start Date | "Recommended Start Date" | Uppercase label |
| Timezone | "Timezone" | Uppercase label |
| Subject | "Subject" | Uppercase label |
| Preview Text | "Preview Text" | Uppercase label |
| Body (Text) | "Body (Text)" | Uppercase label |
| Body (HTML) | "Body (HTML)" | Uppercase label |
| SMS Length | "Length: {count} characters" | Character count |
| **Empty State** |
| No Results | "Fill out the form above and click "Generate Event Campaign" to create your multi-channel promotional campaign." | Empty state message |
| Loading State | "Generating event campaign..." | Loading message |
| **Error Display** |
| Error Header | "Error:" | Error panel header |

---

## 2. AUDIT NOTES + SUGGESTED IMPROVEMENTS

| Current Copy | Issue | Improved Copy | Rationale |
|--------------|-------|---------------|-----------|
| **Page Header** |
| "Turn your Ocala event details into a complete, ready-to-post promo campaign in minutes." | Too wordy, "Ocala" mentioned explicitly | "Turn your event details into a complete, ready-to-post promotional campaign in minutes." | More concise, Ocala context implied by app context |
| **Form Section Headings** |
| "Event Core Details" | "Core" is redundant | "Event Details" | Shorter, clearer |
| "Extra Options" | "Extra" is vague | "Campaign Settings" | More professional, matches V3 pattern |
| **Form Labels** |
| "Services (Optional)" | Parentheses inconsistent with other labels | "Services" | Remove parenthetical, rely on no asterisk |
| "Brand Voice (Optional)" | Parentheses inconsistent | "Brand Voice" | Remove parenthetical, rely on no asterisk |
| "Additional Notes for AI (Optional)" | Too wordy, "for AI" is technical | "Additional Notes" | Shorter, cleaner |
| "Campaign Duration (Days)" | Parentheses awkward | "Campaign Duration" | Helper text explains units |
| **Placeholders** |
| "e.g., Ocala Coffee Shop" | "e.g.," is formal | "Ocala Coffee Shop" | More natural, matches other V3 apps |
| "e.g., Restaurant, Retail, Service" | "e.g.," is formal | "Restaurant, Salon, Service" | More natural, better examples |
| "Comma-separated: e.g., Pressure washing, Driveway cleaning" | Too instructional | "Pressure washing, driveway cleaning, window cleaning" | Natural example, no instruction needed |
| "e.g., March 15, 2026 or 2026-03-15" | Too many options | "March 15, 2026" | Simpler, most common format |
| "e.g., 6:00 PM – 9:00 PM" | Good | "6:00 PM – 9:00 PM" | Keep as is |
| "e.g., 123 Main St, Ocala, FL or Zoom link" | Too many options | "123 Main St, Ocala, FL" | Simpler, most common |
| "Describe what's happening, key details, what attendees can expect..." | Too wordy | "What's happening at this event? What should attendees expect?" | More conversational, clearer |
| "e.g., Local families, horse owners, small business owners" | Good | "Local families, horse owners, small business owners" | Keep as is |
| "Paste 2–4 sentences that sound like your existing brand voice" | Good | "Paste 2–4 sentences that sound like your existing brand voice" | Keep as is |
| "Any special instructions, tone preferences, or context..." | Good | "Any special instructions, tone preferences, or context..." | Keep as is |
| **Helper Text** |
| "How many days before the event should the campaign start? (3–30 days)" | Good | "How many days before the event should the campaign start? (3–30 days)" | Keep as is |
| **Checkbox Labels** |
| "📘 Facebook" | Good | "Facebook" | Remove emoji for consistency (or keep if other V3 apps use them) |
| "📸 Instagram" | Good | "Instagram" | Remove emoji for consistency |
| "✖️ X (Twitter)" | Emoji + parenthetical | "X (Twitter)" | Remove emoji, keep parenthetical for clarity |
| "📍 Google Business Profile" | Good | "Google Business Profile" | Remove emoji for consistency |
| "📧 Email Announcement" | Good | "Email Announcement" | Remove emoji for consistency |
| "💬 SMS Blasts" | "Blasts" is aggressive | "SMS Messages" | Softer, more professional |
| "🖼️ Image Caption" | Good | "Image Caption" | Remove emoji for consistency |
| **Button Labels** |
| "Generate Event Campaign" | Good | "Generate Campaign" | Shorter, matches "Create Campaign" in config |
| "Generating Campaign..." | Good | "Generating campaign..." | Sentence case for consistency |
| "Regenerate with Same Inputs" | Too wordy | "Regenerate" | Shorter, clearer |
| "Start New Campaign" | Good | "Start New Campaign" | Keep as is |
| "Copy" | Good | "Copy" | Keep as is |
| "Copied!" | Good | "Copied!" | Keep as is |
| **Error Messages** |
| "Business name is required." | Good | "Please enter a business name." | More friendly, matches V3 pattern |
| "Business type is required." | Good | "Please enter a business type." | More friendly |
| "Event name is required." | Good | "Please enter an event name." | More friendly |
| "Event description is required." | Good | "Please describe the event." | More conversational |
| "Event date is required." | Good | "Please enter an event date." | More friendly |
| "Event time is required." | Good | "Please enter an event time." | More friendly |
| "Event location is required." | Good | "Please enter an event location." | More friendly |
| "At least one channel must be selected." | Good | "Please select at least one channel." | More friendly |
| "An error occurred while generating your event campaign. Please try again." | Good | "Something went wrong while generating your campaign. Please try again." | Shorter, matches V3 pattern |
| **Result Section Headings** |
| "Generated Event Campaign" | Good | "Generated Campaign" | Shorter |
| "Campaign Overview" | Good | "Campaign Overview" | Keep as is |
| "Social Media Posts" | Good | "Social Media Posts" | Keep as is |
| "Hashtag Bundles" | Good | "Hashtag Bundles" | Keep as is |
| "Campaign Schedule Ideas" | Too wordy | "Posting Schedule" | Shorter, clearer |
| **Result Card Titles** |
| "Event Title Options" | "Options" is redundant | "Event Titles" | Shorter |
| "Short Descriptions" | Good | "Short Descriptions" | Keep as is |
| "Long Description" | Good | "Long Description" | Keep as is |
| "📘 Facebook" | Inconsistent emoji usage | "Facebook" | Remove emoji for consistency |
| "📸 Instagram Caption" | Inconsistent emoji usage | "Instagram Caption" | Remove emoji for consistency |
| "✖️ X (Twitter)" | Inconsistent emoji usage | "X (Twitter)" | Remove emoji for consistency |
| "📍 Google Business Profile" | Inconsistent emoji usage | "Google Business Profile" | Remove emoji for consistency |
| "📸 Instagram Story Ideas" | Inconsistent emoji usage | "Instagram Stories" | Remove emoji, shorter title |
| "📧 Email Announcement" | Inconsistent emoji usage | "Email Announcement" | Remove emoji for consistency |
| "💬 SMS Blasts" | "Blasts" is aggressive | "SMS Messages" | Softer, more professional |
| "🖼️ Image Caption" | Inconsistent emoji usage | "Image Caption" | Remove emoji for consistency |
| "{platform} Hashtags" | Good | "{platform} Hashtags" | Keep as is |
| **Result Card Subtitles** |
| "Primary Tagline" | Good | "Primary Tagline" | Keep as is |
| "Primary Call to Action" | Good | "Primary Call to Action" | Keep as is |
| "Recommended Start Date" | Good | "Recommended Start Date" | Keep as is |
| "Timezone" | Good | "Timezone" | Keep as is |
| "Subject" | Good | "Subject" | Keep as is |
| "Preview Text" | Good | "Preview Text" | Keep as is |
| "Body (Text)" | Good | "Body (Text)" | Keep as is |
| "Body (HTML)" | Good | "Body (HTML)" | Keep as is |
| "Length: {count} characters" | Good | "Length: {count} characters" | Keep as is |
| **Empty State** |
| "Fill out the form above and click "Generate Event Campaign" to create your multi-channel promotional campaign." | Too wordy, quotes around button text | "Fill out the form above and click Generate Campaign to create your multi-channel promotional campaign." | Shorter, no quotes needed |
| "Generating event campaign..." | Good | "Generating campaign..." | Shorter |
| **Error Display** |
| "Error:" | Good | "Error" | Remove colon, cleaner |

---

## 3. REFERENCE APP COMPARISON

**Offers Builder Patterns:**
- Button: "Create Promo" (short, action-oriented)
- Error: "Please enter a business name." (friendly, imperative)
- Section: "Business Basics" (matches Event Campaign Builder)
- Helper text: Concise, one-line

**Image Caption Generator Patterns:**
- Button: "Write Captions" (short, action-oriented)
- Placeholders: Natural examples without "e.g.,"
- Labels: No parenthetical "(Optional)" - relies on no asterisk

**Consistency Notes:**
- V3 apps use sentence case for most UI text
- Error messages are friendly and imperative ("Please enter...")
- Button labels are short and action-oriented
- Section headings are concise (2-3 words)
- Placeholders use natural examples, not "e.g.,"

---

## 4. FINAL POLISHED COPY

### A. Revised Form Labels
- Business Name *
- Business Type *
- Services
- City
- State
- Event Name *
- Event Date *
- Event Time *
- Event Location *
- Event Type
- Event Description *
- Target Audience
- Main Goal
- Budget Level
- Urgency Level
- Brand Voice
- Personality Style
- Language
- Campaign Duration
- Additional Notes

### B. Revised Helper Text
- Campaign Duration: "How many days before the event should the campaign start? (3–30 days)" (unchanged)

### C. Revised Section Headings
- Business Basics (unchanged)
- Event Details (was "Event Core Details")
- Strategy (unchanged)
- Brand & Style (unchanged)
- Channels (unchanged)
- Campaign Settings (was "Extra Options")

### D. Revised Button Text
- Primary CTA: "Generate Campaign" (was "Generate Event Campaign")
- Loading: "Generating campaign..." (sentence case)
- Regenerate: "Regenerate" (was "Regenerate with Same Inputs")
- Start New: "Start New Campaign" (unchanged)
- Copy: "Copy" (unchanged)
- Copied: "Copied!" (unchanged)

### E. Revised Card Titles
- Campaign Overview (unchanged, no title in card)
- Event Titles (was "Event Title Options")
- Short Descriptions (unchanged)
- Long Description (unchanged)
- Facebook (removed emoji)
- Instagram Caption (removed emoji)
- X (Twitter) (removed emoji)
- Google Business Profile (removed emoji)
- Instagram Stories (was "📸 Instagram Story Ideas")
- Email Announcement (removed emoji)
- SMS Messages (was "💬 SMS Blasts")
- Image Caption (removed emoji)
- {platform} Hashtags (unchanged)
- Posting Schedule (was "Campaign Schedule Ideas", no title in card)

### F. Empty State / Fallback Messages
- No Results: "Fill out the form above and click Generate Campaign to create your multi-channel promotional campaign."
- Loading: "Generating campaign..."

### G. Error Message Polishing
- "Please enter a business name."
- "Please enter a business type."
- "Please enter an event name."
- "Please describe the event."
- "Please enter an event date."
- "Please enter an event time."
- "Please enter an event location."
- "Please select at least one channel."
- "Something went wrong while generating your campaign. Please try again."

---

## 5. IMPLEMENTATION CHECKLIST

- [ ] Update page tagline
- [ ] Update section headings
- [ ] Update form labels (remove parentheticals)
- [ ] Update placeholders (remove "e.g.,", simplify)
- [ ] Update checkbox labels (remove emojis, update SMS)
- [ ] Update button labels
- [ ] Update error messages
- [ ] Update result section headings
- [ ] Update result card titles
- [ ] Update empty state messages
- [ ] Update loading messages
- [ ] Verify consistency across all copy

---

## 6. KEY IMPROVEMENTS SUMMARY

1. **Consistency**: Removed emojis from channel labels for cleaner, more professional appearance
2. **Conciseness**: Shortened button labels and section headings
3. **Friendliness**: Updated error messages to be more conversational ("Please enter..." instead of "X is required.")
4. **Clarity**: Simplified placeholders (removed "e.g.," and excessive options)
5. **Professionalism**: Changed "SMS Blasts" to "SMS Messages" for softer tone
6. **Simplicity**: Removed parenthetical "(Optional)" from labels, relying on asterisk convention

---

**Next Step**: Implement all changes in `page.tsx`
