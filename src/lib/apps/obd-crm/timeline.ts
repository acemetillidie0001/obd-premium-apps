import type { CrmContact, CrmContactActivity } from "./types";
import { BookingStatus, type BookingRequest } from "@/lib/apps/obd-scheduler/types";

export type TimelineSource = "CRM" | "Scheduler" | "Reviews";

export interface TimelineEntry {
  id: string;
  label: string;
  at: string; // ISO string
  source: TimelineSource;
}

export interface CrmNonNoteActivity {
  id: string;
  type: string;
  summary: string | null;
  occurredAt: string | null;
  createdAt: string;
}

function toTimeOrNull(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function normalizeLine(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeLower(v: unknown): string {
  return normalizeLine(v).toLowerCase();
}

function detectReviewEventFromNote(
  content: string
): { label: "Review request sent" | "Review received"; source: "Reviews" } | null {
  const lower = normalizeLower(content);

  // Canonical note written by review-request-automation/send-email
  // Example: "Review request sent via email on 2026-01-19 | Campaign: <name>"
  if (lower.startsWith("review request sent via ")) {
    return { label: "Review request sent", source: "Reviews" };
  }

  // Canonical note written by review-request-automation/reviewed
  if (lower === "review received (confirmed by customer)") {
    return { label: "Review received", source: "Reviews" };
  }

  return null;
}

export function detectReviewSignalsFromNotes(notes: Array<Pick<CrmContactActivity, "content">>): {
  hasReviewRequestSent: boolean;
  hasReviewReceived: boolean;
} {
  let hasReviewRequestSent = false;
  let hasReviewReceived = false;

  for (const n of notes) {
    const hit = detectReviewEventFromNote(n.content);
    if (!hit) continue;
    if (hit.label === "Review request sent") hasReviewRequestSent = true;
    if (hit.label === "Review received") hasReviewReceived = true;
  }

  return { hasReviewRequestSent, hasReviewReceived };
}

export function buildContactTimeline({
  contact,
  notes,
  activities,
  schedulerRequests,
}: {
  contact: Pick<CrmContact, "id" | "nextFollowUpAt">;
  notes: Array<Pick<CrmContactActivity, "id" | "content" | "createdAt">>;
  activities?: CrmNonNoteActivity[];
  schedulerRequests?: BookingRequest[];
}): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  // Notes (CRM) + Review events (from canonical CRM notes)
  for (const n of notes) {
    const t = toTimeOrNull(n.createdAt);
    if (!t) continue;

    const reviewHit = detectReviewEventFromNote(n.content);
    if (reviewHit) {
      out.push({
        id: `crm-note:${n.id}:reviews`,
        label: reviewHit.label,
        at: n.createdAt,
        source: reviewHit.source,
      });
    } else {
      out.push({
        id: `crm-note:${n.id}`,
        label: "Note added",
        at: n.createdAt,
        source: "CRM",
      });
    }
  }

  // Follow-up scheduled (current state only; no history inference)
  if (contact.nextFollowUpAt) {
    const t = toTimeOrNull(contact.nextFollowUpAt);
    if (t) {
      out.push({
        id: `crm-followup:scheduled:${contact.id}:${contact.nextFollowUpAt}`,
        label: "Follow-up scheduled",
        at: contact.nextFollowUpAt,
        source: "CRM",
      });
    }
  }

  // Follow-up completed (explicit CRM activity created by "Mark follow-up as done")
  for (const a of activities || []) {
    if (a.type !== "TASK") continue;
    const summary = normalizeLine(a.summary);
    if (!summary.startsWith("Completed follow-up")) continue;

    const at = a.occurredAt || a.createdAt;
    const t = toTimeOrNull(at);
    if (!t) continue;

    out.push({
      id: `crm-followup:completed:${a.id}`,
      label: "Follow-up completed",
      at,
      source: "CRM",
    });
  }

  // Booking occurred (Scheduler): only COMPLETED requests with an explicit scheduled time
  for (const r of schedulerRequests || []) {
    if (r.status !== BookingStatus.COMPLETED) continue;
    const at = r.proposedStart || r.preferredStart;
    const t = toTimeOrNull(at);
    if (!t || !at) continue;

    out.push({
      id: `scheduler-booking:completed:${r.id}`,
      label: "Booking completed",
      at,
      source: "Scheduler",
    });
  }

  // Sort newest -> oldest
  out.sort((a, b) => (toTimeOrNull(b.at) ?? 0) - (toTimeOrNull(a.at) ?? 0));

  // De-dupe by id (defensive)
  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}


