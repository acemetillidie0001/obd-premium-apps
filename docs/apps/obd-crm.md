# OBD CRM V3.1

## Local Development Setup

### Database Configuration

OBD CRM requires a PostgreSQL database connection. To set up local development:

1. **Create `.env.local` in the repo root:**
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

2. **Restart the dev server:**
   ```bash
   # Stop the current server (Ctrl+C)
   pnpm dev
   ```
   ⚠️ **Important:** Next.js only loads `.env.local` when the server starts. You must restart after adding/changing `DATABASE_URL`.

3. **Apply database migrations:**
   ```bash
   pnpm run migrate:deploy
   ```
   This creates the required CRM tables (CrmContact, CrmTag, CrmContactActivity, CrmContactTag).

4. **Verify setup:**
   - Open the CRM page: `http://localhost:3000/apps/obd-crm`
   - Check the debug endpoint: `http://localhost:3000/api/debug/env-check`
   - If you see errors, check the browser console and API responses for specific guidance

### Troubleshooting

- **"DATABASE_URL is not set" error:** Add `DATABASE_URL` to `.env.local` and restart the dev server.
- **"CRM database tables are missing" error:** Run `pnpm run migrate:deploy` to apply migrations.
- **Connection errors:** Verify your database server is running and the connection string is correct.

---

## What It Is

OBD CRM is the customer relationship management hub within the Ocala Business Directory (OBD) Business Suite. It provides local businesses with a unified system to manage customer contacts, track interactions through notes and activities, set follow-up reminders, and seamlessly integrate with other OBD premium applications. Built specifically for small to medium-sized local businesses, OBD CRM focuses on simplicity, speed, and context preservation across the entire OBD ecosystem.

**Version:** V3.1  
**Status:** **LOCKED (Maintenance Mode)**

Maintenance mode means:
- Only critical bug fixes / security / tenant-safety / shared utility inheritance
- No new features unless a new tier is intentionally opened

---

## Tier 5A / 5B / 5C Rollup (2026-01-19)

These upgrades make CRM more trustworthy and “hub-like” without changing its scope.

### Tier 5A — UX Parity (UI-only)

- **Accordion filters**: advanced filters live in accordion sections with summary lines when collapsed.
- **Sticky actions**:
  - Bulk selection actions stay accessible via sticky toolbar.
  - Contact detail edit mode shows a sticky Save/Cancel bar; Save is disabled (not hidden) when nothing changed.
- **Stronger empty/no-results states**: calm guidance with clear CTAs (Add Contact, Import CSV).

### Tier 5B — Determinism + Canonical View

- **Canonical selector** (single source of truth for list view, counts, and export alignment):
  - `src/lib/apps/obd-crm/selectors/getActiveContacts.ts`
- **Deterministic follow-up buckets** (computed from a stable reference timestamp):
  - **Overdue**: \(nextFollowUpAt < startOfToday\)
  - **Today**: \(startOfToday \le nextFollowUpAt \le endOfToday\)
  - **Upcoming**: \(nextFollowUpAt > endOfToday\)
  - **None**: no follow-up date
- **Export trust**:
  - UI banner: “Export reflects your current view (filters + sort).”
  - Export uses the same normalized filter/sort meaning as the UI.

### Tier 5C — Ecosystem Awareness (Read-only signals; link-only CTAs)

- Contact detail page adds a **Signals** section that is **read-only** and only shown when safe signals exist.
- **Scheduler awareness**: detects “Has booked before” / “Upcoming booking” by reading tenant-scoped scheduler requests and matching **exact email only** (no fuzzy matching).
- **Reviews awareness**: derived from existing CRM notes content (“review request sent” / “review received”).
- **Help Desk awareness**: static guidance line plus a link.

**Guarantees (Tier 5C safety):**
- No schema changes
- No background jobs added by CRM UI/API
- No cross-app mutation added by the Tier 5C read-only Signals/Timeline features
- No background jobs

---

## Optional CRM Upgrades 1–4 (2026-01-19)

These are **additive** upgrades focused on clarity and context. They do not introduce “CRM brain,” scheduling, or inference.

### Optional 1 — Activity Timeline (Read-only)

Contact detail now includes a **Timeline** section that shows explicit events only (newest → oldest), with label + timestamp + source.

**Sources (existing data only):**
- **CRM**: Notes (`/api/obd-crm/contacts/[id]/notes`) and Activities (`/api/obd-crm/contacts/[id]/activities`)
- **Scheduler**: Booking completion awareness via tenant-scoped requests (`/api/obd-scheduler/requests`) and **exact email match**
- **Reviews**: Canonical CRM notes written by the Reviews system (no fuzzy parsing)

**Not included:**
- No inference / summarization
- No automation
- No cross-app writes

### Optional 2 — Saved Views (Light presets; no rules)

CRM supports **Saved Views** as **filter + sort presets only**.

**What is stored:**
- Current filters (search/status/tag/follow-up/notes filter)
- Current sort (field + direction)

**What it is NOT:**
- No saved results
- No saved counts
- No background refresh logic
- No “rules engine”

**Storage:**
- Per-business localStorage key: `obd:crm:<businessId>:savedViews:v1`

### Optional 3 — CRM Health Snapshot (Advisory only)

The CRM list page shows a small, calm **CRM Health Snapshot** panel, e.g.:
- “3 contacts need follow-up”
- “5 contacts have no notes”

**Guarantees:**
- Advisory tone only
- No urgency coloring
- No “You should” language
- No actions inside the panel (no buttons)
- Metrics come only from canonical selector outputs
- Hidden when there are 0 total contacts (empty state already covers the messaging)

### Optional 4 — CSV Import UX Micro-Polish (UI-only)

CSV import now provides clearer confidence cues without CRM import backend changes:
- Pre-import summary (total rows detected; estimated add vs skip)
- Clear column mapping recap
- Explicit confirmation copy and button
- Post-import success includes a clear “View contacts” next step

**Intentional non-changes:**
- No parsing logic changes (`src/lib/utils/csvParser.ts` remains the single CSV parser utility)
- No new CSV import validation rules (still requires header row; name required; max 1000 rows)
- Import remains **create-only** (duplicates are skipped; no updates to existing contacts)
- Export endpoint was tightened to match the UI’s canonical view more precisely (notes filter + follow-up day-boundary alignment + safe `lastTouchAt` sort)

### Explicit guarantees for Optional 1–4

- No pipelines / deal stages added
- No automation rules engine added
- No cross-app mutation added by these features
- Tenant-safe behavior remains business-scoped

## Who It's For

OBD CRM is designed for:

- **Local business owners** managing customer relationships without complex enterprise CRM overhead
- **Service-based businesses** (contractors, consultants, professional services) who need to track client interactions and follow-ups
- **Sales teams** requiring a lightweight contact management system with follow-up tracking
- **Businesses using multiple OBD apps** who want seamless context handoffs between tools
- **Teams handling 10-1000 contacts** where client-side filtering and in-memory operations provide responsive performance

The system prioritizes ease of use over advanced automation, making it ideal for businesses that want powerful CRM capabilities without the learning curve of enterprise solutions.

---

## Core Features

### Contacts List + Detail Drawer

The contacts list provides a comprehensive table view with search, filtering, and sorting capabilities. Each contact can be opened in a slide-out detail drawer that displays full contact information, interaction history, and quick action buttons. The drawer supports inline editing, allowing users to update contact details without navigating away from the list.

**Key capabilities:**
- Search by name, email, or phone number
- Filter by status (Lead, Active, Past, DoNotContact) or tags
- Sort by name, creation date, or last update
- Responsive table with sticky header during scroll
- Density toggle (Comfortable/Compact) with preference persistence
- Row-level quick actions (copy email, copy phone, open drawer)

### Notes (Stored as Activity Type "note")

Notes are timestamped text entries that capture customer interactions, conversations, and important details. In V3.1, notes are implemented as activities with type "note", providing a unified data model for future expansion. Notes appear in chronological order (newest first) within the contact detail drawer, with skeleton loaders during fetch and empty states when no notes exist.

**Features:**
- Quick note entry with textarea input
- Automatic timestamping on creation
- Newest-first chronological display
- Live `lastTouchAt` updates after adding notes
- Empty state messaging when no notes exist
- Skeleton loaders during async loading

### Activities (Typed Timeline)

The activities system provides a structured timeline of customer interactions beyond simple notes. Each activity has a type (CALL, EMAIL, TEXT, MEETING, TASK, OTHER), an optional summary field, and an optional `occurredAt` datetime for historical tracking. Activities appear alongside notes in the contact timeline, giving users a complete view of all customer touchpoints.

**Activity types:**
- **CALL**: Phone conversations
- **EMAIL**: Email exchanges
- **TEXT**: SMS/text messages
- **MEETING**: In-person or virtual meetings
- **TASK**: Action items or reminders
- **OTHER**: Miscellaneous interactions

**Features:**
- Type selection dropdown
- Summary text field for activity description
- Optional `occurredAt` datetime for backdating historical activities
- Newest-first chronological display
- Live `lastTouchAt` updates after adding activities
- Empty state messaging when no activities exist

### Last Touch Updates After Note/Activity

The `lastTouchAt` field automatically updates whenever a note or activity is added to a contact. This timestamp appears in the contacts list as a "Last Touch" column, showing relative time formatting ("5m ago", "2d ago", "3w ago"). The field updates in real-time without requiring a page refresh, providing immediate visual feedback that the contact record has been updated.

**Display format:**
- Relative time for recent touches (e.g., "5m ago", "2h ago")
- Absolute dates for older touches (e.g., "Jan 15, 2024")
- Live updates without page refresh
- Visible in both table and queue views

### Next Follow-Up System

The follow-up system enables businesses to set reminder dates for future customer interactions, with comprehensive filtering, visual indicators, and quick management tools.

**Filters:**
- **All**: Show all contacts regardless of follow-up status
- **Due Today**: Contacts with follow-ups scheduled for today
- **Overdue**: Contacts with follow-ups in the past
- **Upcoming**: Contacts with follow-ups scheduled after today

**Badges:**
- **"Today" badge** (orange): Displayed for contacts with follow-ups due today
- **"Overdue" badge** (red): Displayed for contacts with overdue follow-ups
- Badges appear in both the table view and the contact detail drawer header

**Snooze:**
- **"Snooze 1 day"** button: Advances follow-up date by 1 day while preserving time-of-day
- **"Snooze 1 week"** button: Advances follow-up date by 1 week while preserving time-of-day
- Quick action buttons available in both table and queue views

**Quick Set Buttons:**
- **Tomorrow**: Sets follow-up to tomorrow at the same time-of-day
- **Next week**: Sets follow-up to 7 days from now at the same time-of-day
- **Next month**: Sets follow-up to 30 days from now at the same time-of-day
- Preserves existing time-of-day when setting new dates

**Counters:**
- Summary strip showing counts for Overdue, Today, and Upcoming follow-ups
- Clickable counts that filter the list to that specific status
- Updates dynamically as follow-ups are added, modified, or cleared

**Queue View:**
- Toggle between table and queue views (preference persists in localStorage)
- Queue organizes contacts into three urgency-based sections:
  - **Overdue**: Follow-ups past their due date
  - **Due Today**: Follow-ups due today
  - **Upcoming**: Follow-ups scheduled after today
- Smart sorting within each group (most urgent first)
- Compact card layout optimized for quick scanning
- Inline snooze buttons on queue cards
- "Caught up" empty state when all sections are empty
- Respects same search and filter settings as table view

---

## Premium UX Polish Highlights

### Empty/No-Results States

Thoughtful empty states guide users when no data is available:
- **No contacts**: Helpful message with "Add Contact" call-to-action
- **No notes**: "No notes yet" message with note entry prompt
- **No activities**: "No activities yet" message with activity entry prompt
- **Queue empty**: "Caught up" celebration message when all follow-up sections are empty
- **Search no results**: Clear messaging when filters return zero contacts

### Sticky Header + Density Toggle

The contacts table header remains visible during vertical scrolling, ensuring column headers and filter controls are always accessible. A density toggle allows users to switch between "Comfortable" and "Compact" row spacing, with the preference saved to localStorage and applied consistently across sessions.

### Row Quick Actions + Copy Confirmation

Each contact row includes always-visible action buttons:
- **Copy email**: Copies email address to clipboard with visual confirmation
- **Copy phone**: Copies phone number to clipboard with visual confirmation
- **Open detail**: Opens the contact detail drawer

Copy actions show brief inline confirmation messages that auto-dismiss after ~2 seconds, providing clear feedback without interrupting workflow.

### Status/Tag Chips with Overflow Tooltip

Contact status and tags are displayed as color-coded pill chips. When multiple tags are present, overflow is handled gracefully:
- Visible tags shown as chips
- "+N" indicator for additional tags beyond the visible set
- Tooltip on hover showing all tag names
- Consistent pill styling across status and tag chips
- Color-coded status badges (Lead, Active, Past, DoNotContact)

### Skeleton Loaders

Smooth loading states prevent layout shifts and provide visual feedback:
- **Table skeleton**: Animated pulse effect during initial contact list load
- **Drawer skeleton**: Loading state when opening contact detail drawer
- **Notes skeleton**: Loading indicators while fetching notes
- **Activities skeleton**: Loading indicators while fetching activities
- Consistent styling that matches final content layout

### Mobile FAB

A floating action button (FAB) appears on mobile devices, providing quick access to:
- **Add Contact**: Opens contact creation form
- **Import CSV**: Opens CSV import modal

The FAB is positioned responsively and includes a menu toggle for accessing multiple actions. On desktop, these actions are available in the main header toolbar.

### Drawer Animations + ESC Close + Click-Outside Close + Scroll Restore

The contact detail drawer provides a premium slide-in experience:
- **Smooth animations**: Slide-in from right with backdrop fade
- **ESC key close**: Press Escape to close drawer
- **Click-outside close**: Click backdrop to close drawer (desktop)
- **Scroll restore**: Drawer content scroll position is preserved when reopening the same contact
- **Keyboard navigation**: Full keyboard accessibility support

### Tooltips / Icon Consistency / Subtle Gradient Accent

Attention to detail throughout the interface:
- **Tooltips**: Icon-only buttons include title/aria-label attributes for accessibility
- **Icon consistency**: Consistent icon usage across similar actions
- **Subtle gradient accent**: Gentle gradient backgrounds on action buttons and highlights
- **Hover states**: Smooth transitions on interactive elements
- **Focus indicators**: Clear focus rings for keyboard navigation

---

## Integrations

OBD CRM integrates seamlessly with other OBD premium apps, enabling context-preserving handoffs and return navigation.

### CRM → Review Request Automation

**Integration point:** "Send Review Request" button in contact detail drawer

**Context handoff:**
- Contact name, email, and phone pre-filled in Review Request Automation
- Return URL parameter enables navigation back to CRM contact
- Contact information automatically populated in review request form

**User flow:**
1. User opens contact in CRM drawer
2. Clicks "Send Review Request" button
3. Redirected to Review Request Automation with contact context
4. Can navigate back to CRM contact via return link

### CRM → AI Help Desk

**Integration point:** "Ask AI Help Desk" button in contact detail drawer

**Context handoff:**
- Contact name and recent notes/activities passed via sessionStorage
- Default prompt pre-filled with contact context
- Optional inclusion of last note or activity timeline in prompt
- Return URL parameter enables navigation back to CRM contact

**User flow:**
1. User opens contact in CRM drawer
2. Clicks "Ask AI Help Desk" button
3. Modal allows customization of prompt and context inclusion
4. Redirected to AI Help Desk with pre-filled prompt
5. Can navigate back to CRM contact via return link

### CRM → Social Auto-Poster

**Integration point:** "Draft Social Post" button in contact detail drawer

**Context handoff:**
- Contact name and information passed via URL parameters
- Intent selection (Follow-up, Thank-you, Testimonial ask, Promo mention)
- Optional inclusion of last note or last activity in post context
- Platform selection (All, Facebook, Instagram, Google Business)
- Return URL parameter enables navigation back to CRM contact

**User flow:**
1. User opens contact in CRM drawer
2. Clicks "Draft Social Post" button
3. Modal allows selection of intent, platform, and context options
4. Redirected to Social Auto-Poster Composer with pre-filled context
5. Can navigate back to CRM contact via return link

### CRM → Offers Builder

**Integration point:** "Create Offer" button in contact detail drawer

**Context handoff:**
- Contact name and information passed via URL parameters
- Goal selection (Reactivation, New customer, Upsell, Referral)
- Offer type selection (Discount, Free add-on, Limited-time deal, Bundle)
- Optional hint text and last note inclusion
- Return URL parameter enables navigation back to CRM contact

**User flow:**
1. User opens contact in CRM drawer
2. Clicks "Create Offer" button
3. Modal allows selection of goal, type, and context options
4. Redirected to Offers Builder with pre-filled context
5. Can navigate back to CRM contact via return link

### Standard Context Indicators

All integrated apps display consistent UX indicators:
- **"CRM context loaded" pill**: Visual indicator when context is passed from CRM
- **"Back to CRM Contact" link**: Navigation link to return to originating contact
- **Theme persistence**: Dark mode preference maintained across app routes via `useOBDTheme` hook

---

## Known Limitations + Planned Upgrades

### Current Limitations

**Client-Side Filtering:**
- Follow-up filters operate client-side only, which works well for typical contact volumes (< 1000 contacts) but may become slow with very large datasets
- Search and status/tag filters also operate client-side for responsive performance

**Queue View Pagination:**
- Queue view does not support server-side pagination and uses in-memory filtering
- All contacts must be loaded to display queue sections accurately

**CSV Import Format:**
- Import handles basic CSV format (comma-separated, quoted fields, header row required)
- Advanced CSV features (multi-line fields, custom delimiters) not yet supported

**Snooze in Queue:**
- Snooze buttons in queue view require contact detail to be loaded, creating a minor UX delay

### Planned Upgrades (Not in V3.1)

**Server-Side Pagination:**
- Support for large contact lists (1000+ contacts) with server-side filtering and pagination
- Improved performance for businesses with extensive contact databases

**Advanced Follow-Up Automation:**
- Recurring follow-ups with customizable intervals
- Automated reminder notifications
- Follow-up templates for common scenarios

**Activity Templates:**
- Pre-defined activity templates for common interaction types
- Quick-add buttons for frequently used activity patterns

**Bulk Operations:**
- Bulk tag assignment across multiple contacts
- Bulk follow-up setting for contact groups
- Bulk status updates

**Email/SMS Integration:**
- Direct email composition from CRM
- SMS sending capabilities
- Email/SMS history tracking

**Calendar Sync:**
- Sync follow-ups with external calendars (Google Calendar, Outlook)
- Two-way calendar integration

**Pipelines/Deals (V4+):**
- Sales pipeline visualization
- Deal tracking and stage management
- Revenue forecasting

**Automations (V4+):**
- Workflow automation for common tasks
- Trigger-based actions (e.g., auto-tag on status change)
- Custom automation rules

---

## Related Documentation

- [V3.1 Release Notes](../releases/obd-crm-v3.1.md)
- [V3.1 Production Audit](../audits/obd-crm-v3.1-production-audit.md)
- [Changelog](../../CHANGELOG.md)
