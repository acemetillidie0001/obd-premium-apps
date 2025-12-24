# Reputation Dashboard - Changelog

All notable changes to the Reputation Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2024-12-24

### Added
- Manual review entry via accessible modal form with validation
- Enhanced CSV import with tolerant parsing (handles various date/rating/boolean formats)
- Automatic column mapping for flexible CSV headers
- Row-level validation errors displayed in CSV preview modal
- CSV template download functionality with example data
- Score breakdown drawer/modal showing sub-scores, weights, contributions, and raw inputs
- Export functionality: JSON export (includes `computedAt` and `snapshotId`) and CSV export
- Print-friendly report view with header showing timestamp and snapshot ID
- Export/Print guards: buttons disabled until compute + non-empty dataset with helpful tooltips
- Automatic localStorage persistence with restore on page load
- Clear Data button with confirmation dialog
- Low-data gating with warnings for < 5 reviews and guarded states for theme extraction
- Explainability metadata: sentiment derivation (`sentimentDerivedFrom`) and confidence levels (`sentimentConfidence`)
- Theme extraction with matched keywords (top 3) and theme confidence levels
- Quality signals panel with deterministic insights and severity levels (info/warning/critical)
- Performance guards: CSV preview pagination (200 rows default), large import warnings (>2000 reviews)
- Chart robustness: handles sparse data, single points, tooltips with keyboard accessibility
- Last Computed timestamp tracking (stored in state and localStorage, displayed in header)
- Deterministic Snapshot ID (RD-XXXXXXXX format) computed from normalized reviews, business name, and date range using FNV-1a 32-bit hash
- Dataset hooks (V4 placeholder): `datasetInfo` structure ready for future database persistence
- Modal accessibility: focus trap, ESC key support, ARIA labels
- Keyboard navigation for charts (points/bars are focusable with aria-labels)
- Pure engine module (`engine.ts`) for testable calculations
- Unit tests for engine functions (vitest)
- Hash utility (`hash.ts`) for deterministic snapshot ID generation

### Changed
- Refactored all calculations into pure engine module (`src/lib/apps/reputation-dashboard/engine.ts`)
- Improved CSV parsing to handle quoted fields safely and prevent formula injection
- Enhanced error handling with friendly messages (no PII exposure)
- Updated UI to use OBD V3 design system consistently
- Improved accessibility across all components (modals, charts, tooltips)
- API response now includes `snapshotId` and `computedAt` fields
- Score breakdown uses neutral default (50% response rate = 20 points) when no responses exist

### Fixed
- Removed console.error statements for production (replaced with silent failures or conditional dev logging)
- Fixed sentinel value handling (-1 for no responses properly converted to N/A in UI)
- Fixed CSV parsing to prevent formula injection (all values treated as plain text)
- Fixed modal accessibility (focus trap, ESC key, ARIA labels)
- Fixed chart rendering for edge cases (empty arrays, single point, sparse data, zero values)
- Fixed localStorage error handling (silent failures for quota exceeded or unavailable)
- Fixed CSV preview pagination to use incremental "Show more" button instead of page-based system

### Security
- Added input validation for all API routes using Zod schemas
- Prevented formula injection in CSV parsing
- Removed PII from logs (review text not logged in production)
- Added defensive error handling without exposing sensitive data

---

## [2.0.0] - Previous Version

(Previous changelog entries would go here)

---

## [1.0.0] - Initial Release

(Initial release notes would go here)
