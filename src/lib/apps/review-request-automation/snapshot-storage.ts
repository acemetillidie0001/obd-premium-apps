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
const SNAPSHOT_HISTORY_STORAGE_KEY = "rra.snapshotHistory.v1";

export type ReviewRequestSnapshotHistoryStore = {
  schemaVersion: typeof RRA_SNAPSHOT_SCHEMA_VERSION;
  /**
   * Newest-first immutable snapshots (created-time values).
   * NOTE: We do not mutate historical entries after insertion.
   */
  snapshots: ReviewRequestCampaignSnapshot[];
  /**
   * Points at the user's explicitly chosen active snapshot.
   * This does not change when the user merely views a historical snapshot.
   */
  activeSnapshotId: string | null;
};

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

function isSnapshotLike(value: unknown): value is ReviewRequestCampaignSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ReviewRequestCampaignSnapshot>;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "string" &&
    v.schemaVersion === RRA_SNAPSHOT_SCHEMA_VERSION &&
    typeof v.campaign === "object" &&
    Array.isArray(v.customers) &&
    Array.isArray(v.events) &&
    typeof v.response === "object"
  );
}

function normalizeHistoryStore(raw: unknown): ReviewRequestSnapshotHistoryStore | null {
  if (!raw || typeof raw !== "object") return null;
  const store = raw as Partial<ReviewRequestSnapshotHistoryStore>;
  if (store.schemaVersion !== RRA_SNAPSHOT_SCHEMA_VERSION) return null;
  if (!Array.isArray(store.snapshots)) return null;
  const snapshots = store.snapshots.filter(isSnapshotLike);
  const activeSnapshotId = typeof store.activeSnapshotId === "string" ? store.activeSnapshotId : null;
  return {
    schemaVersion: RRA_SNAPSHOT_SCHEMA_VERSION,
    snapshots,
    activeSnapshotId,
  };
}

export function loadSnapshotHistoryStore(): ReviewRequestSnapshotHistoryStore {
  if (typeof window === "undefined") {
    return { schemaVersion: RRA_SNAPSHOT_SCHEMA_VERSION, snapshots: [], activeSnapshotId: null };
  }

  // Primary: history store.
  const rawHistory = window.localStorage.getItem(SNAPSHOT_HISTORY_STORAGE_KEY);
  if (rawHistory) {
    const parsedHistory = safeParseJson<unknown>(rawHistory);
    const normalized = normalizeHistoryStore(parsedHistory);
    if (normalized) return normalized;
  }

  // Backwards-compat: migrate existing active snapshot into a one-entry history store.
  const active = loadActiveSnapshot();
  const migrated: ReviewRequestSnapshotHistoryStore = active
    ? {
        schemaVersion: RRA_SNAPSHOT_SCHEMA_VERSION,
        snapshots: [active],
        activeSnapshotId: active.id,
      }
    : { schemaVersion: RRA_SNAPSHOT_SCHEMA_VERSION, snapshots: [], activeSnapshotId: null };

  saveSnapshotHistoryStore(migrated);
  return migrated;
}

export function saveSnapshotHistoryStore(store: ReviewRequestSnapshotHistoryStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_HISTORY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage failures (quota, disabled, etc.)
  }
}

export function addSnapshotToHistoryStore(
  snapshot: ReviewRequestCampaignSnapshot,
  opts?: { setActive?: boolean }
): ReviewRequestSnapshotHistoryStore {
  const setActive = opts?.setActive ?? false;
  const store = loadSnapshotHistoryStore();

  // Ensure newest-first; keep prior entries; do not mutate existing entries.
  const nextSnapshots = [snapshot, ...store.snapshots.filter((s) => s.id !== snapshot.id)];
  const next: ReviewRequestSnapshotHistoryStore = {
    ...store,
    snapshots: nextSnapshots,
    activeSnapshotId: setActive ? snapshot.id : store.activeSnapshotId,
  };
  saveSnapshotHistoryStore(next);
  return next;
}

export function setActiveSnapshotIdInHistoryStore(snapshotId: string | null): ReviewRequestSnapshotHistoryStore {
  const store = loadSnapshotHistoryStore();
  const next: ReviewRequestSnapshotHistoryStore = { ...store, activeSnapshotId: snapshotId };
  saveSnapshotHistoryStore(next);
  return next;
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

