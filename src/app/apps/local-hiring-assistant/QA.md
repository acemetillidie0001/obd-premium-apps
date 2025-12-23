# Local Hiring Assistant – QA Checklist

## 1. Basic sanity checks
- [ ] Page loads at `/local-hiring-assistant` with no console errors.
- [ ] Form defaults:
  - [ ] City defaults to "Ocala"
  - [ ] State defaults to "Florida"
  - [ ] Employment Type defaults to "Full-Time"
  - [ ] Work Location defaults to "On-site"
  - [ ] Personality Style defaults to "None"
  - [ ] Language defaults to "English"
  - [ ] Job Post Length defaults to "Medium"
  - [ ] All output toggles default to ON.

## 2. Required field validation
- [ ] Submitting with empty form shows an error for missing Business Name.
- [ ] Submitting with Business Name only shows error for Business Type.
- [ ] Submitting without a Role Title shows a Role Title error.
- [ ] No network call is fired when required validation fails.

## 3. Successful generation
- [ ] Using the "Basic happy path" request in `qa.http` returns a 200 OK.
- [ ] Response JSON contains:
  - [ ] jobTitle (non-empty)
  - [ ] companyName (non-empty)
  - [ ] location (non-empty; includes Ocala, Florida)
  - [ ] jobDescriptionSections array with at least 3 sections.
  - [ ] meta.modelVersion is "local-hiring-v1" or similar.
  - [ ] meta.createdAt is a valid ISO timestamp.
- [ ] Frontend renders all jobDescriptionSections without crashing.

## 4. Output toggles
- [ ] When includeShortJobPostPack = false, API still returns 200 and either omits the field or sets it to null, and the UI does not render the "Short Job Post Pack" section.
- [ ] When includeScreeningQuestions = false, response has no screeningQuestions and UI does not render that section.
- [ ] When includeInterviewQuestions = false, response has no interviewQuestions and UI does not render that section.
- [ ] When includeBenefitsHighlight = false, response has no benefitsHighlight and UI does not render that section.
- [ ] When includeApplicationInstructions = false, response has no applicationInstructions and UI does not render that section.

## 5. Language behavior
- [ ] With language = "English", all text is generated in English.
- [ ] With language = "Spanish", all text is generated in Spanish.
- [ ] With language = "Bilingual", posts and descriptions include both English and Spanish mixed in a readable way.

## 6. Personality style
- [ ] Soft style feels warm and reassuring.
- [ ] Bold style feels confident, direct, and decisive.
- [ ] High-Energy style feels upbeat and energetic without being chaotic.
- [ ] Luxury style feels refined and elevated.
- [ ] When brandVoice is provided, it overrides the default personality style.

## 7. Error handling
- [ ] If the model returns malformed JSON (simulated by temporarily tweaking SYSTEM_PROMPT), the API returns a 500 with a helpful error.
- [ ] Network or OpenAI errors are caught and surfaced as a friendly error message on the page.

## 8. UX and layout
- [ ] Layout matches other V3 apps:
  - [ ] Single main column with form at top, results below button.
  - [ ] No empty right column on desktop.
  - [ ] Results appear directly below "Generate hiring campaign" button.
- [ ] On mobile, everything appears as single vertical column (form → button → results).
- [ ] Buttons and inputs use Tailwind classes consistent with the rest of the suite.
- [ ] Dark mode toggle works and all text/backgrounds are theme-aware.

## 9. Comma-separated fields behavior
- [ ] Services field: Can type "Deep cleaning, Roof washing, Driveway pressure wash" with spaces and commas.
- [ ] Responsibilities field: Allows normal typing with spaces and commas.
- [ ] Must-Have Skills, Nice-to-Have Skills, Certifications, Benefits: All allow free typing.
- [ ] Arrays are correctly sent to API (check network tab - should see arrays, not strings).

## 10. Copy-to-clipboard functionality
- [ ] Full Job Description: Copy button copies all sections as formatted text.
- [ ] Short Job Post Pack: Each platform post has its own copy button.
- [ ] Screening Questions: Copy button copies all questions with rationales.
- [ ] Interview Questions: Copy button copies all questions with rationales.
- [ ] Benefits Highlight: Copy button copies as bullet list.
- [ ] Application Instructions: Copy button copies full text.
- [ ] All copy buttons show "Copied!" feedback for 2 seconds.
- [ ] Copy works in both light and dark mode.
