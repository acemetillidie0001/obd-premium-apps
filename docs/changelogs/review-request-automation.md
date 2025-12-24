# Review Request Automation - Changelog

## [V3] - 2025-12-24

### Added
- Quick Start banner with interactive guide on first load
- Campaign Health Score: Deterministic health assessment with status badge (Good/Needs Attention/At Risk), score (0-100), and detailed reasons in hover tooltip
- Template Quality Score: Per-template quality badges (Good/Too Long/Missing Opt-out/Link Issue/Needs Review) with severity levels (info/warning/critical), detailed analysis, and actionable suggestions in tooltips
- Smart Defaults: Business type-based recommendations (Restaurant/Food, Home Services, Beauty/Wellness, Auto/Trades, Medical/Healthcare, Retail) with opt-in "Apply" button (never auto-override user settings)
- Send Timeline: Visual read-only timeline above Queue tab showing Now → Initial Send → Follow-Up schedule using actual computed queue times
- Inline Micro-Education: Expandable info panels (collapsed by default) with info icons next to follow-up delay, quiet hours, and frequency cap fields, explaining "why this matters" with practical, non-technical content
- Best-Practice Guidance: Non-binding recommendations section in Results tab using "recommended range" / "common best practice" wording (no market data claims), with "Consider adjusting" notes for out-of-range settings
- Bulk actions in Queue tab (select all, mark selected as sent/clicked/reviewed)
- Export queue to CSV functionality (includes exportedAt timestamp)
- Export campaign to JSON functionality (includes exportedAt timestamp)
- Accessible tooltips and keyboard support for all actions
- CSV template download button (already present, now with tooltip)
- Campaign builder with business info, message settings, and automation rules
- Customer management with manual entry and CSV import
- Message template generator (SMS Short, SMS Standard, Email, Follow-Up SMS)
- Support for English, Spanish, and Bilingual languages
- Four tone styles: Friendly, Professional, Bold, Luxury
- Send queue computation with quiet hours, frequency caps, and follow-up rules
- Manual status tracking (Mark Sent, Clicked, Reviewed, Opted Out)
- Results dashboard with funnel metrics, quality checks, and next actions
- CSV import with tolerant parsing and row-level validation
- localStorage persistence for campaigns, customers, and events
- Comprehensive unit tests for engine functions
- Empty state messages for all tabs
- Character count and segment warnings for SMS templates
- Quality checks for invalid review links, SMS length, follow-up aggressiveness, quiet hours, and missing contact info

### Changed
- Improved quiet hours validation to handle midnight wrap-around correctly
- Enhanced token replacement to handle email templates (subject + body) properly
- Updated channel selection to skip customers without contact info (was defaulting to SMS)
- Enhanced UX with Quick Start banner that dismisses when user starts working
- Improved Queue tab with bulk selection and actions, plus Send Timeline visualization
- Added comprehensive tooltips and keyboard support throughout
- Template Quality Score: Segment counter guidance now ties to quality details
- Smart Defaults: Recommendations only appear after templates are generated (requires businessType input)

### Fixed
- Channel selection bug: Customers without phone/email were incorrectly defaulting to SMS channel
- Email template token replacement: Now properly replaces {firstName} in both subject and body
- Quiet hours validation: Now correctly handles midnight wrap-around cases
- Empty state handling: Added proper empty states for Templates, Queue, and Results tabs

### Security
- CSV parser treats all values as plain text (no formula execution)
- No customer PII logged in production builds
- All error handling is silent on client-side

### Performance
- Queue computation is deterministic and fast (pure functions)
- Customer and queue lists use scrollable containers (max-h-96)
- No blocking operations in UI

### Documentation
- Added comprehensive app documentation: `/docs/apps/review-request-automation-v3.md`
- Added smoke test checklist: `/docs/qa/review-request-automation-v3-smoke-test.md`
- Added audit report: `/docs/audits/review-request-automation-v3-audit.md`
- Added release notes: `/docs/releases/review-request-automation-v3.md`

### Technical
- Strict TypeScript: No `any` types, no `@ts-ignore`, no unsafe casts
- Pure engine module: All computations in testable `engine.ts`
- Comprehensive test coverage
- Lint clean
- Build ready

---

**Note:** V3 does NOT send SMS/email externally. It generates templates and provides a manual send queue with copy buttons. External sending is planned for V4.

