import type { Campaign, Customer, Event, ReviewRequestAutomationResponse } from "./types";

export const RRA_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type ReviewRequestCampaignSnapshot = {
  id: string;
  createdAt: string;
  schemaVersion: typeof RRA_SNAPSHOT_SCHEMA_VERSION;
  campaign: Campaign;
  customers: Customer[];
  events: Event[];
  response: ReviewRequestAutomationResponse;
  /**
   * Optional dataset ID if the user chose "Save to database" during snapshot creation.
   * Used to enable explicit send actions (e.g. email send route).
   */
  datasetId?: string | null;
};

const ACTIVE_SNAPSHOT_STORAGE_KEY = "rra.activeSnapshot.v1";

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadActiveSnapshot(): ReviewRequestCampaignSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_SNAPSHOT_STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeParseJson<ReviewRequestCampaignSnapshot>(raw);
  if (!parsed) return null;
  if (parsed.schemaVersion !== RRA_SNAPSHOT_SCHEMA_VERSION) return null;
  return parsed;
}

export function saveActiveSnapshot(snapshot: ReviewRequestCampaignSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore localStorage failures (quota, disabled, etc.)
  }
}

export function clearActiveSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_SNAPSHOT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function generateSnapshotId(): string {
  // Prefer crypto.randomUUID when available (browser).
  // Fallback to a small UUID-like generator.
  if (typeof crypto !== "undefined" && typeof (crypto as unknown as { randomUUID?: () => string }).randomUUID === "function") {
    return (crypto as unknown as { randomUUID: () => string }).randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

