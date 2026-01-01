# OBD Scheduler & Booking V4 - Tier 1: Calendly Parity Foundation

## Overview

**Tier 1 = Calendly parity foundation**

This document outlines the upgrade path from OBD Scheduler & Booking V3.1.3 to V4 Tier 1, which establishes the foundation for Calendly-like functionality. Tier 1 focuses on settings, data models, and UI scaffolding without implementing the full booking behavior yet.

## Version History

- **V3.1.3**: Request-based booking system (current)
- **V4 Tier 1A**: Foundation, DB, Settings UI, Docs (this release)
- **V4 Tier 1B**: (Future) Instant booking slot generation, calendar OAuth, manage links, reminders, Stripe integration

## Tier 1 Parity Checklist

The following features represent Calendly parity for Tier 1 completion:

### Core Features
- [x] **Live Availability**: Real-time slot generation based on availability windows and existing bookings (Tier 1B)
- [ ] **Calendar Sync**: OAuth integration with Google Calendar, Outlook, etc. (Future)
- [ ] **Reschedule/Cancel Links**: Automated email links for customers to manage bookings (Future)
- [ ] **Reminders**: Automated email/SMS reminders before appointments (Future)
- [ ] **Payments**: Stripe integration for deposits and full payments (Future)
- [x] **Branding**: Customizable public booking page (logo, colors, headline, intro) (Tier 1A)
- [ ] **Embed**: Embeddable booking widget for websites (Future)

### Settings & Configuration
- [x] **Booking Mode**: Request vs Instant Allowed (business-level + per-service override) (Tier 1A)
- [x] **Availability Windows**: Business hours by day of week (Tier 1A)
- [x] **Availability Exceptions**: Closed days and custom hours (Tier 1A)
- [x] **Branding/Theme Settings**: Logo, colors, headline, intro text (Tier 1A)
- [ ] **Connected Calendars**: Status UI for calendar connections (Future)
- [ ] **Payment Settings**: Per-service payment configuration (deposit/full) (Future)

## Tier 1A Scope (Completed)

**Tier 1A includes:**
1. Documentation (this file)
2. Prisma models/migrations for new data structures
3. Settings UI scaffolding
4. API routes for settings CRUD (GET/PUT)
5. No behavior changes to existing booking flow

## Tier 1B Scope (Completed)

**Tier 1B includes:**
1. Slot generation engine based on availability windows/exceptions
2. Conflict blocking using existing OBD bookings
3. Instant booking API endpoint
4. Public booking page with dual-mode UI (instant vs request)
5. Server-side slot validation at booking time

**Tier 1B does NOT include:**
- Calendar OAuth integration
- Manage links (reschedule/cancel)
- Reminders
- Stripe payment processing
- Embed widget

## Acceptance Criteria for Tier 1 Completion

### Tier 1A (Current)
- ✅ App builds and runs without errors
- ✅ No regression to V3 booking request flow (`/book/{bookingKey}`)
- ✅ Settings can be saved and loaded per business
- ✅ Availability windows and theme persist correctly in DB
- ✅ Standardized API responses in new routes
- ✅ All new Prisma models have proper tenant scoping (businessId)
- ✅ Migrations run cleanly without data loss

### Tier 1B (Completed)
- [x] Instant booking slots are generated based on availability windows
- [x] Slot generation respects min notice, max days out, buffer minutes
- [x] Conflict blocking prevents double-booking
- [x] Instant booking creates APPROVED bookings immediately
- [x] Public booking page shows instant booking UI when enabled
- [x] Request-based booking still works as fallback
- [ ] Calendar OAuth connects and syncs events (Future)
- [ ] Customers receive reschedule/cancel links via email (Future)
- [ ] Reminders are sent automatically before appointments (Future)
- [ ] Stripe payments process deposits and full payments (Future)
- [ ] Embed widget can be added to external websites (Future)

## Data Model Changes (Tier 1A)

### New Models

#### `AvailabilityWindow`
- Per-business recurring availability by day of week
- Fields: `dayOfWeek` (0-6), `startTime`, `endTime`, `isEnabled`

#### `AvailabilityException`
- Per-business one-time availability overrides
- Fields: `date`, `startTime?`, `endTime?`, `type` (CLOSED_ALL_DAY | CUSTOM_HOURS)

#### `BookingTheme`
- Per-business branding for public booking page
- Fields: `logoUrl`, `primaryColor`, `accentColor`, `headlineText`, `introText`

### Updated Models

#### `BookingSettings`
- Added: `bookingModeDefault` (REQUEST_ONLY | INSTANT_ALLOWED)
- Existing fields remain unchanged

#### `BookingService`
- Added: `paymentRequired` (NONE | DEPOSIT | FULL)
- Added: `depositAmountCents?`, `currency?`
- Existing fields remain unchanged

## API Routes

### Tier 1A Routes
- `GET /api/obd-scheduler/availability` - Get availability windows and exceptions
- `PUT /api/obd-scheduler/availability` - Update availability windows and exceptions
- `GET /api/obd-scheduler/theme` - Get booking theme settings
- `PUT /api/obd-scheduler/theme` - Update booking theme settings
- `GET /api/obd-scheduler/settings` - Now includes `bookingModeDefault`
- `PUT /api/obd-scheduler/settings` - Now accepts `bookingModeDefault`

### Tier 1B Routes
- `GET /api/obd-scheduler/slots` - Get available booking slots for a date (public, uses bookingKey)
- `POST /api/obd-scheduler/bookings/instant` - Create instant booking (public, uses bookingKey)

## UI Changes (Tier 1A)

### Settings Tab Sections
1. **Booking Mode**: Toggle between Request vs Instant Allowed with explanatory copy
2. **Availability**: Editor UI for business hours by day + exceptions list placeholder
3. **Branding**: Editor UI for logo URL, color pickers, headline, intro text
4. **Connected Calendars**: Placeholder showing "Not connected" state
5. **Payments**: Placeholder per service row (disabled, shows "Stripe not configured")

## Non-Negotiables

- ✅ Multi-tenant safety: All queries scoped by `businessId`
- ✅ No breaking changes to `/book/{bookingKey}` route
- ✅ Standardized API responses everywhere
- ✅ Defensive validation schemas for all new routes
- ✅ Clean migrations (no destructive changes)

## Migration Notes

- All new models include `businessId` for tenant scoping
- Default values ensure backward compatibility
- Existing `BookingSettings` records will get `bookingModeDefault = REQUEST_ONLY` on migration
- Existing `BookingService` records will get `paymentRequired = NONE` on migration

## Testing Checklist

### Tier 1A (Completed)
- [x] Settings can be saved and retrieved
- [x] Availability windows persist correctly
- [x] Theme settings persist correctly
- [x] Existing booking request flow still works
- [x] Public booking page still loads
- [x] No console errors in browser
- [x] No database errors in server logs

### Tier 1B (Completed)
- [x] Slots are generated correctly for enabled availability windows
- [x] Slots respect min notice hours
- [x] Slots respect max days out
- [x] Slots respect buffer minutes
- [x] Existing bookings block conflicting slots
- [x] Instant booking creates APPROVED bookings
- [x] Slot validation happens server-side at booking time
- [x] Double booking is prevented
- [x] Request-based booking still works
- [x] Public booking page shows correct UI based on booking mode

## Next Steps (Future Enhancements)

1. Add Google Calendar OAuth integration
2. Add Outlook Calendar OAuth integration
3. Implement reschedule/cancel link generation
4. Add email reminder system
5. Integrate Stripe payment processing
6. Build embed widget component
7. Add calendar sync background jobs
8. Add per-service booking mode overrides

## References

- V3 Documentation: `docs/apps/obd-scheduler-v3.md`
- Prisma Schema: `prisma/schema.prisma`
- API Types: `src/lib/apps/obd-scheduler/types.ts`

