# Ecosystem Flow — Tier 5C

## Purpose

Tier 5C provides lightweight, non-blocking guidance to help users discover related apps and workflows in the OBD ecosystem. These "Next steps" panels appear contextually after users complete work in one app, suggesting natural next actions.

## Rules

### Link-Only
- **No auto-handoff**: Panels only show links, never automatically transfer data or mutate state
- **No payload mutation**: Panels are purely presentational; they do not modify app state or content
- **User-initiated navigation**: All workflows start when the user clicks a link

### Dismissible (sessionStorage)
- **SessionStorage-based dismissal**: Once dismissed, panels do not reappear during the current browser session
- **Per-panel dismiss keys**: Each panel uses a unique `dismissKey` for independent dismissal state
- **No persistence across sessions**: Dismissal resets when the browser session ends

### Non-Blocking
- **Conditional rendering**: Panels only appear when relevant content exists (e.g., FAQs generated, schema exportable)
- **Never hide functionality**: Panels are additive guidance, never required for core app functionality
- **Graceful degradation**: If sessionStorage unavailable, panels still render (dismissal just doesn't persist)

## Current Flows

### Website Draft Import → FAQ Generator / Schema Generator / AI Help Desk

**Trigger**: When `acceptedDraft` exists (draft accepted from Content Writer)

**Location**: Below CMS Import Helpers section

**Steps**:
1. FAQ Generator → "Generate FAQs" - "Turn this page into customer-ready FAQs."
2. Business Schema Generator → "Add Page Schema" - "Improve search visibility with structured data."
3. AI Help Desk → "Use in AI Help Desk" - "Answer customer questions automatically using this content."

**Dismiss Key**: `tier5c-website-draft-next-steps`

---

### FAQ Generator → Schema Generator / AI Help Desk

**Trigger**: When at least one FAQ exists (`effectiveFAQs.length > 0`)

**Location**: Below Export Center section

**Steps**:
1. Business Schema Generator → "Add FAQ Schema" - "Make your FAQs eligible for rich results."
2. AI Help Desk → "Import into Help Desk" - "Answer customer questions automatically."

**Dismiss Key**: `tier5c-faq-generator-next-steps`

---

### Schema Generator → AI Help Desk

**Trigger**: When schema is exportable/valid (`result?.data` exists)

**Location**: Below Export / Validation section

**Steps**:
1. AI Help Desk → "Use with AI Help Desk" - "Power customer answers with your website content."

**Dismiss Key**: `tier5c-schema-generator-next-steps`
