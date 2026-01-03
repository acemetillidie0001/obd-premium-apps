# OBD Scheduler & Booking — Documentation Index

Welcome to the OBD Scheduler & Booking documentation. This index helps you find the information you need.

## V1 Scope

OBD Scheduler V1 focuses on core booking functionality with a clean, reliable experience for both businesses and customers. Here's what's included and what's coming in future releases.

### V1 Includes

- **Public booking link** (bookingKey-based): Secure, shareable booking URLs
- **Service selection**: Customers can choose from your active services
- **Availability windows + exceptions**: Set your business hours and block specific dates
- **Request booking mode**: Customers submit requests for your approval
- **Instant booking mode**: When enabled, customers can book immediately
- **Email notifications**: Customer confirmations and business alerts
- **Admin request management dashboard**: View, filter, sort, and manage all booking requests

### V1 Excludes (Coming Soon / Not in V1)

- **Payment processing**: No payment collection or deposits in V1
- **SMS notifications**: Email-only notifications in V1 (SMS coming in future release)
- **Calendar sync**: No Google Calendar or Microsoft Outlook integration in V1
- **Automated reminders**: No automated follow-up emails or drip sequences
- **Client login/accounts**: Customers don't create accounts or view booking history
- **Multi-staff routing**: Single-staff booking model in V1

> **Note**: Features will expand in V1.x as we roll out improvements based on user feedback.

---

## Quick Links

### 📖 [Overview & Architecture](./../apps/obd-scheduler-v3.md#overview)
Complete technical documentation covering:
- System architecture and design principles
- Data models (BookingService, BookingSettings, BookingRequest)
- Status flow and valid transitions
- API routes and endpoints
- Business scoping and validation rules

**Location:** [`docs/apps/obd-scheduler-v3.md`](./../apps/obd-scheduler-v3.md)

---

### 🎛️ [Admin Dashboard Usage](./../apps/obd-scheduler-v3.md#uiux-requirements)
Guide for business owners managing bookings:
- **Requests Tab**: View, filter, sort, and manage booking requests
  - Smart Views (Needs Action, Upcoming, Past Due, Completed, Declined, All)
  - Sorting options (newest/oldest, appointment time, recently updated)
  - Bulk actions (select and decline multiple requests)
  - Archive/Hide functionality
  - CSV export
- **Services Tab**: Create and manage bookable services
- **Availability Tab**: Configure timezone, buffer times, and booking windows
- **Branding Tab**: Customize public booking form appearance
- **Settings Tab**: Manage booking policies, notification email, and public booking link

**Location:** [`docs/apps/obd-scheduler-v3.md#uiux-requirements`](./../apps/obd-scheduler-v3.md#uiux-requirements)

**Recent Enhancements (Tier 5.7):**
- Smart Views for filtering requests by status
- Sorting controls for better request organization
- Bulk actions for efficient request management
- Archive/Hide to declutter your dashboard
- CSV export for reporting and backups

---

### 🌐 [Public Booking Page Behavior](./../apps/obd-scheduler-v3.md#public-booking-link-strategy)
Documentation for the customer-facing booking experience:
- **Clean Booking URLs**: `/book/[bookingKey]` format
- **Service Selection**: Customers can choose from active services
- **Time Normalization**: Preferred times automatically round to 15-minute increments
- **Rate Limiting**: Anti-spam protection (5 requests per 10-minute window)
- **Booking Key Security**: 64-character hex string for secure public links

**Location:** [`docs/apps/obd-scheduler-v3.md#public-booking-link-strategy`](./../apps/obd-scheduler-v3.md#public-booking-link-strategy)

**Recent Enhancements (Tier 5.6):**
- New clean URL format: `https://apps.ocalabusinessdirectory.com/book/{bookingKey}`
- Service dropdown in public booking form
- Automatic time rounding to 15-minute increments
- Enhanced rate limiting for spam protection

---

### 📝 [Changelog](./../changelogs/obd-scheduler.md)
Complete history of all changes, improvements, and bug fixes:
- **Tier 5.7**: Dashboard productivity features (Smart Views, Sorting, Bulk Actions, Archive, CSV Export)
- **Tier 5.6**: Public booking enhancements (clean URLs, service selection, time normalization, rate limiting)
- **Tier 5.5**: CRM integration (automatic contact sync)
- **Tier 5.4**: SMS notifications (Twilio integration, quiet hours, rate limiting)

**Location:** [`docs/changelogs/obd-scheduler.md`](./../changelogs/obd-scheduler.md)

---

## Additional Resources

### Release Notes
- **[Tier 5.4-5.7 Release Notes](./../releases/OBD_SCHEDULER_TIER1_RELEASE_NOTES.md#obd-scheduler--booking--tier-54-57-release-notes)**: Detailed release notes for recent improvements
- **[Tier 1 Release Notes](./../releases/OBD_SCHEDULER_TIER1_RELEASE_NOTES.md)**: Initial hardening and UX upgrades

### Key Features

#### Notifications
- **Email Notifications**: Customer confirmations and business alerts
  - See: [Email Notification Templates](./../apps/obd-scheduler-v3.md#email-notification-templates)
- **SMS Notifications** (Tier 5.4): SMS confirmations via Twilio
  - Quiet hours enforcement (9pm-8am default)
  - Rate limiting per businessId:phone
  - STOP/HELP command support

#### Integrations
- **CRM Integration** (Tier 5.5): Automatic contact sync to OBD CRM
  - Booking requests create/update CRM contacts
  - Activity notes generated for each request
  - Tagged with "Booking Request"

#### Dashboard Features (Tier 5.7)
- **Smart Views**: Filter by status (Needs Action, Upcoming, Past Due, Completed, Declined, All)
- **Sorting**: Sort by newest/oldest, appointment time, or recently updated
- **Bulk Actions**: Select and decline multiple requests at once
- **Archive/Hide**: Archive completed requests to keep dashboard focused
- **CSV Export**: Download filtered/sorted requests as CSV

---

## Getting Started

1. **For Business Owners**: Start with [Admin Dashboard Usage](./../apps/obd-scheduler-v3.md#uiux-requirements)
2. **For Developers**: Start with [Overview & Architecture](./../apps/obd-scheduler-v3.md#overview)
3. **For Customers**: Share your [Public Booking Link](./../apps/obd-scheduler-v3.md#public-booking-link-strategy) (`/book/[bookingKey]`)

---

## Support

For issues or questions, contact the OBD development team.

---

## Version Information

- **Current Version**: Tier 5.7
- **Documentation Last Updated**: See [Changelog](./../changelogs/obd-scheduler.md) for latest updates

