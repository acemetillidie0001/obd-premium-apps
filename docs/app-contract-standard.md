# OBD V3 App Contract Standard

## Overview

This document defines the standard request/response structure, validation rules, and naming conventions for all OBD V3 apps.

## V3 Request Structure

### Base Request Fields

All app requests should extend the base structure:

```typescript
interface BaseAppRequest {
  // Business Information (optional but recommended)
  businessName?: string;
  businessType?: string;
  services?: string;
  city?: string;
  state?: string;
  
  // Brand Voice (optional)
  brandVoice?: string;
  personalityStyle?: "None" | "Soft" | "Bold" | "High-Energy" | "Luxury" | "";
  
  // Content Options (optional)
  language?: "English" | "Spanish" | "Bilingual" | string;
  length?: "Short" | "Medium" | "Long";
}
```

### App-Specific Fields

Each app can add its own specific fields. Examples:

**Review Responder:**
- `platform`: "Google" | "OBD" | "Facebook" | "Other"
- `reviewRating`: 1 | 2 | 3 | 4 | 5
- `reviewText`: string (required)
- `customerName`: string (optional)
- `responseGoal`: string (optional)
- `includeQnaBox`: boolean
- `includeMetaDescription`: boolean
- `includeStoryVersion`: boolean

**Business Description Writer:**
- `targetAudience`: string (optional)
- `uniqueSellingPoints`: string (optional)
- `keywords`: string (optional)
- `writingStyleTemplate`: "Default" | "Story-Driven" | "SEO-Friendly" | "Short & Punchy" | "Luxury Premium"
- `includeFAQSuggestions`: boolean
- `includeMetaDescription`: boolean

## V3 Response Structure

### Base Response Fields

All app responses should extend:

```typescript
interface BaseAppResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown; // App-specific fields
}
```

### Conditional Outputs

Conditional outputs (based on request flags) should:
1. Only be included if the corresponding request flag is `true`
2. Be `undefined` or `null` if not included
3. Follow consistent naming conventions

**Example:**
```typescript
interface ReviewResponderResponse {
  standardReply: string; // Always included
  shortReply: string; // Always included
  qnaBox?: QnaBoxItem[]; // Only if includeQnaBox === true
  metaDescription?: string; // Only if includeMetaDescription === true
  storytellingVersion?: string; // Only if includeStoryVersion === true
}
```

## Required/Optional Fields

### Required Fields
- Fields marked with `*` in the UI are required
- API should validate required fields and return 400 with error message if missing
- Error message format: `{ error: "Field name is required" }`

### Optional Fields
- Optional fields should be `undefined` in the request if not provided
- API should handle `undefined` gracefully
- Default values should be applied server-side when appropriate

## Validation Rules

### String Fields
- Trim whitespace before validation
- Empty strings after trimming should be treated as `undefined`
- Maximum length should be enforced (app-specific)

### Number Fields
- Validate ranges (e.g., `reviewRating` must be 1-5)
- Return 400 with descriptive error if out of range

### Enum Fields
- Validate against allowed values
- Return 400 if invalid value provided

### Boolean Fields
- Default to `true` for optional boolean flags if not provided
- Use `?? true` pattern: `includeFAQSuggestions ?? true`

## Naming Conventions

### Request Fields
- Use `camelCase` for all field names
- Be descriptive: `businessName` not `name`
- Use consistent naming across apps: `businessName`, `businessType`, `services`

### Response Fields
- Use `camelCase` for all field names
- Be descriptive: `standardReply` not `reply`
- Use consistent naming: `metaDescription` (not `metaDesc` or `description`)

### Conditional Output Naming
- Use descriptive names: `includeQnaBox` → `qnaBox` in response
- Use plural for arrays: `faqSuggestions`, `taglineOptions`
- Use singular for objects: `socialBioPack`, `preview`

## How Conditional Outputs Must Be Returned

### Pattern 1: Optional Fields
```typescript
interface Response {
  alwaysIncluded: string;
  conditionalField?: string; // Only if flag was true
}
```

### Pattern 2: Nullable Fields
```typescript
interface Response {
  alwaysIncluded: string;
  conditionalField: string | null; // null if flag was false
}
```

**Recommendation:** Use Pattern 1 (`?` optional) for cleaner TypeScript.

### Implementation Example

```typescript
// API Route
const response: ReviewResponderResponse = {
  standardReply: generateStandardReply(...),
  shortReply: generateShortReply(...),
  socialSnippet: generateSocialSnippet(...),
  whyChooseSection: generateWhyChoose(...),
};

if (request.includeQnaBox) {
  response.qnaBox = generateQnaBox(...);
}

if (request.includeMetaDescription) {
  response.metaDescription = generateMetaDescription(...);
}

if (request.includeStoryVersion) {
  response.storytellingVersion = generateStoryVersion(...);
}

return response;
```

## Example Request + Response for Each App

### 1. Review Responder

**Request:**
```json
{
  "businessName": "Ocala Coffee Shop",
  "businessType": "Coffee Shop",
  "services": "Specialty coffee, pastries, breakfast",
  "city": "Ocala",
  "state": "Florida",
  "platform": "Google",
  "reviewRating": 5,
  "reviewText": "Amazing coffee and friendly staff!",
  "customerName": "John",
  "responseGoal": "Thank and invite back",
  "brandVoice": "Warm and welcoming",
  "personalityStyle": "Soft",
  "responseLength": "Medium",
  "language": "English",
  "includeQnaBox": true,
  "includeMetaDescription": true,
  "includeStoryVersion": true
}
```

**Response:**
```json
{
  "standardReply": "Thank you, John! We're thrilled...",
  "shortReply": "Thanks, John! We appreciate...",
  "socialSnippet": "We love hearing from our customers...",
  "whyChooseSection": "At Ocala Coffee Shop, we...",
  "qnaBox": [
    {
      "question": "What are your hours?",
      "answer": "We're open Monday-Friday 7am-5pm..."
    }
  ],
  "metaDescription": "Ocala Coffee Shop - Specialty coffee...",
  "storytellingVersion": "When John walked into our shop..."
}
```

### 2. Business Description Writer

**Request:**
```json
{
  "businessName": "Ocala Massage & Wellness",
  "businessType": "Spa & Wellness",
  "services": "Swedish massage, deep tissue, hot stone therapy",
  "city": "Ocala",
  "state": "Florida",
  "targetAudience": "Busy professionals, athletes",
  "uniqueSellingPoints": "Licensed therapists, organic products",
  "keywords": "Ocala massage, wellness spa",
  "brandVoice": "Relaxing and professional",
  "personalityStyle": "Soft",
  "writingStyleTemplate": "Default",
  "includeFAQSuggestions": true,
  "includeMetaDescription": true,
  "descriptionLength": "Medium",
  "language": "English"
}
```

**Response:**
```json
{
  "obdListingDescription": "Ocala Massage & Wellness offers...",
  "websiteAboutUs": "Welcome to Ocala Massage & Wellness...",
  "googleBusinessDescription": "Professional massage therapy...",
  "socialBioPack": {
    "facebookBio": "Relax and rejuvenate at Ocala Massage...",
    "instagramBio": "✨ Your wellness journey starts here...",
    "xBio": "Professional massage therapy in Ocala...",
    "linkedinTagline": "Ocala Massage & Wellness - Licensed Therapists"
  },
  "taglineOptions": [
    "Relax. Rejuvenate. Restore.",
    "Your wellness is our priority"
  ],
  "elevatorPitch": "Ocala Massage & Wellness provides...",
  "faqSuggestions": [
    {
      "question": "What types of massage do you offer?",
      "answer": "We offer Swedish, deep tissue, and hot stone therapy..."
    }
  ],
  "metaDescription": "Ocala Massage & Wellness - Licensed massage therapists..."
}
```

### 3. Social Media Post Creator

**Request:**
```json
{
  "businessName": "Ocala Coffee Shop",
  "businessType": "Coffee Shop",
  "platform": "facebook",
  "topic": "New seasonal latte flavors",
  "tone": "engaging",
  "details": "Pumpkin spice and maple pecan now available",
  "brandVoice": "Friendly and energetic",
  "personalityStyle": "High-Energy",
  "postLength": "Medium",
  "campaignType": "New Service Announcement",
  "outputMode": "Standard",
  "numberOfPosts": 3,
  "hashtagStyle": "Normal",
  "emojiStyle": "Normal"
}
```

**Response:**
```json
{
  "response": "Post 1 — Facebook\nHook: Fall flavors are here! 🍂\nBody:\n- Try our new Pumpkin Spice Latte\n- Maple Pecan Latte also available\n- Limited time only\nCTA: Visit us today to try one!\n\nPost 2 — Instagram\n..."
}
```

### 4. FAQ Generator

**Request:**
```json
{
  "businessName": "Ocala Plumbing Services",
  "businessType": "Plumbing",
  "topic": "Emergency services and pricing",
  "details": "24/7 emergency service, flat-rate pricing",
  "brandVoice": "Professional and helpful",
  "personalityStyle": "None",
  "faqCount": 5,
  "answerLength": "Medium",
  "tone": "professional",
  "hasEmoji": "Minimal",
  "theme": "pricing"
}
```

**Response:**
```json
{
  "response": "FAQ 1\nQ: Do you offer 24/7 emergency service?\nA: Yes, we provide round-the-clock emergency plumbing services...\n\nFAQ 2\nQ: What is your pricing structure?\nA: We use flat-rate pricing for transparency..."
}
```

### 5. Content Writer

**Request:**
```json
{
  "businessName": "Ocala Landscaping Co",
  "businessType": "Landscaping",
  "services": "Lawn care, irrigation, hardscaping",
  "topic": "Spring lawn care tips",
  "contentType": "BlogPost",
  "contentGoal": "Educate homeowners",
  "targetAudience": "Homeowners in Ocala",
  "tone": "Informative",
  "brandVoice": "Expert and friendly",
  "keywords": "Ocala lawn care, spring landscaping",
  "language": "English",
  "length": "Medium",
  "writingStyleTemplate": "SEO-Friendly",
  "includeFAQ": true,
  "includeSocialBlurb": true,
  "includeMetaDescription": true,
  "mode": "Content"
}
```

**Response:**
```json
{
  "mode": "Content",
  "blogIdeas": [],
  "content": {
    "title": "Spring Lawn Care Tips for Ocala Homeowners",
    "seoTitle": "Spring Lawn Care Tips Ocala | Expert Guide 2024",
    "metaDescription": "Discover expert spring lawn care tips...",
    "slugSuggestion": "spring-lawn-care-tips-ocala",
    "outline": [
      "Introduction to spring lawn care",
      "Essential tasks for March-April",
      "Fertilization schedule",
      "Common mistakes to avoid"
    ],
    "sections": [
      {
        "heading": "Introduction to Spring Lawn Care",
        "body": "As winter fades and spring arrives in Ocala..."
      }
    ],
    "faq": [
      {
        "question": "When should I start fertilizing my lawn?",
        "answer": "In Ocala, start fertilizing in late February..."
      }
    ],
    "socialBlurb": "Spring is here! 🌱 Get your Ocala lawn ready...",
    "preview": {
      "cardTitle": "Spring Lawn Care Tips",
      "cardSubtitle": "Expert Guide for Ocala Homeowners",
      "cardExcerpt": "Discover essential spring lawn care tips..."
    },
    "wordCountApprox": 1200,
    "keywordsUsed": ["Ocala lawn care", "spring landscaping"]
  }
}
```

### 6. Image Caption Generator

**Request:**
```json
{
  "businessName": "Ocala Bakery",
  "businessType": "Bakery",
  "services": ["Custom cakes", "Fresh pastries", "Wedding cakes"],
  "city": "Ocala",
  "state": "Florida",
  "imageContext": "Beautiful wedding cake with floral decorations",
  "imageDetails": "Three-tier white cake with fresh flowers",
  "platform": "Instagram",
  "goal": "Awareness",
  "callToActionPreference": "Soft",
  "brandVoice": "Elegant and celebratory",
  "personalityStyle": "Luxury",
  "captionLength": "Medium",
  "includeHashtags": true,
  "hashtagStyle": "Local",
  "variationsCount": 3,
  "variationMode": "Safe",
  "language": "English"
}
```

**Response:**
```json
{
  "captions": [
    {
      "id": 1,
      "platform": "Instagram",
      "label": "Elegant Celebration",
      "previewHint": "Perfect for wedding season",
      "text": "Every celebration deserves something special. Our custom wedding cakes are crafted with love and attention to detail. ✨",
      "hashtags": ["#OcalaBakery", "#WeddingCakes", "#OcalaWeddings"],
      "lengthMode": "Medium",
      "variationMode": "Safe"
    }
  ]
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": "Business name is required"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation errors)
- `500`: Internal Server Error

## Best Practices

1. **Always validate required fields** before processing
2. **Trim all string inputs** before validation
3. **Use consistent field names** across all apps
4. **Return conditional outputs** only when requested
5. **Provide descriptive error messages** for validation failures
6. **Handle edge cases** gracefully (empty strings, null values)
7. **Document app-specific fields** in code comments

