# Local Hiring Assistant

The Local Hiring Assistant helps Ocala Business Directory business owners generate:

- A complete, structured job description
- Short social job posts for multiple platforms
- Screening questions
- Interview questions
- Benefits highlight bullets
- Application instructions

## Endpoint

`POST /api/local-hiring-assistant`

### Request body

Matches `LocalHiringAssistantRequest` in `types.ts`.

Key fields:

- `businessName` (string, required)
- `businessType` (string, required)
- `roleTitle` (string, required)
- `employmentType` ("Full-Time" | "Part-Time" | "Contract" | "Seasonal" | "Temporary")
- `workLocationType` ("On-site" | "Hybrid" | "Remote")
- `city` / `state` (default to "Ocala" / "Florida" if omitted)
- Role details arrays (responsibilities, mustHaveSkills, benefits, etc.)
- Voice & style: `brandVoice`, `personalityStyle`, `language`, `jobPostLength`
- Output toggles: `includeShortJobPostPack`, `includeScreeningQuestions`, `includeInterviewQuestions`, `includeBenefitsHighlight`, `includeApplicationInstructions`

### Response body

Matches `LocalHiringAssistantResponse` in `types.ts`.

Includes:

- `jobTitle`, `companyName`, `location`
- `jobDescriptionSections`: ordered sections (About the Role, Key Responsibilities, etc.)
- Optional:
  - `shortJobPostPack`
  - `screeningQuestions`
  - `interviewQuestions`
  - `benefitsHighlight`
  - `applicationInstructions`
- `meta`: modelVersion + createdAt

## Notes

- The model is instructed to NEVER mention AI or OBD and to write content as if it came directly from the business.
- The assistant is optimized for local roles in Ocala but will still work for any city/state combination provided.
- All outputs are safe to reuse on job boards, websites, and social media.
