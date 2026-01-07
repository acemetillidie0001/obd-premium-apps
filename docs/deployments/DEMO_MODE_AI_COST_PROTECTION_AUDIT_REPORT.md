# Demo Mode AI Cost Protection Audit Report

## Summary
- Total AI call sites found: 23 routes
- Mutation handlers (POST/PUT/PATCH/DELETE): 23 — all protected
- GET handlers with AI: 0 — none found
- Background jobs with AI: 0 — none found
- Files modified: 1

## Category A: Mutation Handlers — All Protected

All mutation handlers that call AI are protected by Demo Mode enforcement (assertNotDemoRequest) and/or demo short-circuit (isDemoRequest returning sample payloads before any AI call).

Verified AI call sites:
- src/app/api/ai-help-desk/search/route.ts (POST) — AnythingLLM
- src/app/api/ai-help-desk/chat/route.ts (POST) — AnythingLLM
- src/app/api/ai-help-desk/widget/chat/route.ts (POST) — AnythingLLM
- src/app/api/ai-logo-generator/route.ts (POST) — OpenAI
- src/app/api/brand-kit-builder/route.ts (POST) — OpenAI
- src/app/api/business-description-writer/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/content-writer/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/event-campaign-builder/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/faq-generator/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/google-business/audit/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/google-business/pro/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/google-business/pro/competitors/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/google-business/pro/photos/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/google-business/pro/rewrites/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/google-business/wizard/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/image-caption-generator/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/image-engine/generate/route.ts (POST) — OpenAI (image generation)
- src/app/api/image-engine/regenerate/route.ts (POST) — OpenAI (image generation)
- src/app/api/local-hiring-assistant/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/local-keyword-research/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/local-keyword-research/rank-check/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/offers-builder/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/review-responder/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/social-auto-poster/generate/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)
- src/app/api/social-media-post-creator/route.ts (POST) — OpenAI (demo short-circuit via isDemoRequest)

**Note:**
Many endpoints return demo sample payloads when isDemoRequest(req) is true (better demo UX), while all mutation handlers remain protected from writes via assertNotDemoRequest.

## Category B: GET Handlers — No AI Calls Found

No GET handlers directly call AI services. GET routes remain read-only and do not trigger AI costs.

## Category C: Background Jobs & Utilities
### Social Auto-Poster Cron
- src/app/api/social-auto-poster/cron/route.ts (GET/POST)
- Status: Protected (demo guard added to GET handler)
- AI usage: None — publishing only (no AI generation)
- Rationale: Prevent cron execution in demo

