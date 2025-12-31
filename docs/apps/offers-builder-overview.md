# Offers & Promotions Builder — Overview

This document provides an overview of the **Offers & Promotions Builder** app in the OBD Premium Apps suite.

---

## 1. App Purpose & Scope

**Offers & Promotions Builder** converts promotion details into a **multi-platform promotional campaign** for Ocala businesses.

Outputs can include:

- Offer summary (headlines, subheadlines, pitches)
- Headline and body copy variations
- Social media posts (Facebook, Instagram, X, Google Business Profile)
- Email announcements
- SMS messages
- Website banners
- Flyer content
- Graphic prompts for AI image generation

Inputs cover:

- Business basics (name, type, services, location)
- Promotion details (type, description, value, code, dates)
- Strategy (goal, target audience)
- Brand voice & personality
- Language (English, Spanish, Bilingual)
- Output platforms selection
- Content generation preferences

---

## 2. Key Files

**Frontend & Types**

- `src/app/apps/offers-builder/page.tsx`  
  Main V3-style UI: form, submit handler, results cards, copy buttons.

- `src/app/apps/offers-builder/types.ts`  
  Type contracts:
  - `OffersBuilderRequest`
  - `OffersBuilderResponse`
  - `PromoType`, `OutputPlatform`, `PersonalityStyle`, `LanguageOption`

**Backend**

- `src/app/api/offers-builder/route.ts`  
  - Validates request (Zod)  
  - Calls OpenAI (`gpt-4o-mini`) with JSON-only system prompt  
  - Parses & validates response (Zod)  
  - Returns `{ ok: boolean; data?: OffersBuilderResponse; error?: string }`

---

## 3. OBD CRM Integration

**Status: Not applicable yet**

The Offers & Promotions Builder currently does not capture or store person-level recipient information (name, email, phone). The app generates promotional content templates (social posts, email templates, SMS templates, etc.) but does not have functionality to:

- Add or manage recipient lists
- Send offers to specific people
- Store recipient contact information
- Track which offers were sent to which recipients

As such, CRM integration with OBD CRM is **not applicable at this time**. If person-level recipient functionality (such as a "send offer" flow with recipient management) is added in the future, CRM integration can be implemented at that point to:

- Upsert contacts when recipients are added or offers are sent
- Add activity notes when offers are created/sent
- Tag contacts with promotion information

---

## 4. Usage

The app generates ready-to-use promotional content that businesses can copy and use across their marketing channels. All content is generated based on the promotion details provided and is optimized for the selected output platforms.

