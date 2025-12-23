# OBD Premium Apps — Production Smoke Test Checklist

## Manual Checklist

### A. Authentication & Route Protection

#### Logged Out Redirect Tests
- [ ] **`/apps/brand-kit-builder`** → Redirects to `/login?callbackUrl=/apps/brand-kit-builder`
- [ ] **`/ai-logo-generator`** → Redirects to `/apps/ai-logo-generator` → Then redirects to `/login` (if logged out)
- [ ] **`/local-hiring-assistant`** → Redirects to `/apps/local-hiring-assistant` → Then redirects to `/login` (if logged out)
- [ ] **`/apps/review-responder`** → Redirects to `/login?callbackUrl=/apps/review-responder`
- [ ] **`/apps/social-media-post-creator`** → Redirects to `/login?callbackUrl=/apps/social-media-post-creator`

**Expected Behavior:**
- All `/apps/*` routes require authentication
- Legacy routes (`/ai-logo-generator`, `/local-hiring-assistant`) redirect to `/apps/*` first
- Login page shows callback URL in query params
- After login, user is redirected back to original route

### B. Brand Kit Builder Functionality

#### Form & Generation
- [ ] **Form loads** with default values (Ocala, Florida, etc.)
- [ ] **Load Saved Profile** button appears (if user has saved profile)
- [ ] **Form submission** works (all required fields)
- [ ] **Generation completes** without errors
- [ ] **Result cards render** correctly (Colors, Typography, Messaging, Ready-to-Use Copy)
- [ ] **"Save to Brand Profile"** button appears after result exists

#### Copy & Export
- [ ] **Copy buttons** work for each result section
- [ ] **Export TXT** downloads file with all content
- [ ] **Export JSON** downloads valid JSON file
- [ ] **Export PDF** downloads PDF file (Phase 4)
- [ ] **Filename format**: `<businessName>-brand-kit.pdf`

#### Brand Profile Integration
- [ ] **Load Saved Profile** pre-fills form fields
- [ ] **"Last saved: <date>"** displays if profile exists
- [ ] **Save to Brand Profile** persists data
- [ ] **Success toast/notification** appears after save

### C. Cross-App Auto-Load (Review Responder + Social Post Creator)

#### Review Responder
- [ ] **Page loads** without errors
- [ ] **Brand profile auto-loads** (if saved profile exists)
- [ ] **Only empty fields** are pre-filled (doesn't overwrite user input)
- [ ] **brandVoice** field pre-fills from profile
- [ ] **personalityStyle** field pre-fills from profile
- [ ] **businessName, businessType, city, state** pre-fill if empty

#### Social Media Post Creator
- [ ] **Page loads** without errors
- [ ] **Brand profile auto-loads** (if saved profile exists)
- [ ] **Only empty fields** are pre-filled (doesn't overwrite user input)
- [ ] **brandVoice** field pre-fills from profile
- [ ] **personalityStyle** field pre-fills from profile
- [ ] **businessName, businessType, city, state** pre-fill if empty

### D. Language & Localization

- [ ] **Bilingual mode** renders correctly (English + Spanish)
- [ ] **Spanish mode** renders correctly
- [ ] **Language selector** works in all apps
- [ ] **Text content** respects selected language

### E. Extras & Toggles

- [ ] **Include Social Post Templates** toggle renders correct cards
- [ ] **Include FAQ Starter** toggle renders correct cards
- [ ] **Include GBP Description** toggle renders correct cards
- [ ] **Include Meta Description** toggle renders correct cards
- [ ] **All toggles** persist state correctly

### F. Error Handling

- [ ] **Rate limit (429)** displays clear error message with requestId
- [ ] **Network errors** display user-friendly messages
- [ ] **API errors** include requestId for debugging
- [ ] **Validation errors** show field-specific messages

## Automated Checks (Lightweight)

### 1. Authentication Endpoints

```bash
# Test auth providers endpoint
curl -X GET https://your-app.vercel.app/api/auth/providers

# Expected: JSON with email provider
# {
#   "email": {
#     "id": "email",
#     "name": "Email",
#     "type": "email",
#     ...
#   }
# }
```

```bash
# Test CSRF token endpoint
curl -X GET https://your-app.vercel.app/api/auth/csrf

# Expected: JSON with csrfToken
# {
#   "csrfToken": "..."
# }
```

### 2. Protected Route Headers

```bash
# Test protected route redirect (logged out)
curl -I https://your-app.vercel.app/apps/brand-kit-builder

# Expected:
# HTTP/1.1 307 Temporary Redirect
# Location: /login?callbackUrl=/apps/brand-kit-builder
```

```bash
# Test legacy redirect
curl -I https://your-app.vercel.app/ai-logo-generator

# Expected:
# HTTP/1.1 307 Temporary Redirect
# Location: /apps/ai-logo-generator
```

### 3. Brand Profile API (Requires Auth)

```bash
# Test GET brand-profile (requires session cookie)
curl -X GET https://your-app.vercel.app/api/brand-profile \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Expected (if profile exists):
# {
#   "id": "...",
#   "userId": "...",
#   "businessName": "...",
#   ...
# }

# Expected (if no profile):
# null
```

### 4. Health Check Endpoints

```bash
# Test database connection
curl -X GET https://your-app.vercel.app/api/test-db

# Expected: JSON with connection status
```

```bash
# Test Resend email
curl -X GET https://your-app.vercel.app/api/test-resend

# Expected: JSON with email send status
```

## Test Scenarios

### Scenario 1: New User Flow
1. Log in with email (magic link)
2. Visit `/apps/brand-kit-builder`
3. Fill out form and generate brand kit
4. Save to brand profile
5. Visit `/apps/review-responder`
6. Verify form pre-fills with saved brand data

### Scenario 2: Returning User Flow
1. Log in with existing account
2. Visit `/apps/brand-kit-builder`
3. Click "Load Saved Profile"
4. Verify form pre-fills correctly
5. Generate new brand kit
6. Save updated profile

### Scenario 3: Cross-App Consistency
1. Save brand profile in Brand Kit Builder
2. Visit Review Responder
3. Verify brandVoice and personalityStyle match
4. Visit Social Post Creator
5. Verify same brand data is loaded

### Scenario 4: Export Functionality
1. Generate brand kit
2. Test Export TXT download
3. Test Export JSON download
4. Test Export PDF download
5. Verify all files contain correct content

## Notes

- All tests should be run in production environment
- Use real email addresses for magic link testing
- Verify PDF export works in both local and production
- Check Vercel logs for any API errors during testing
- Ensure requestId is included in all error responses

