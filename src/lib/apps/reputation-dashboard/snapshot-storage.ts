/**
 * Reputation Dashboard — Snapshot Storage (Tier 5B)
 *
 * LocalStorage-only persistence for immutable reputation snapshots.
 * No DB, no backend writes, no background jobs.
 */
import type { ReputationDashboardRequest, ReputationDashboardResponse, ReviewInput } from "./types";

export const RD_SNAPSHOT_SCHEMA_VERSION = "rd-snapshot-v1";
export const RD_ENGINE_VERSION = "reputation-dashboard-v3"; // UI-level marker; engine remains unchanged

export interface ReputationSnapshot {
  /** Stable unique id for storage and selection */
  id: string;

  /** Tenant scope key (see callers; typically session.user.id) */
  businessId: string;

  createdAt: string; // ISO

  /** Date window for this snapshot (resolved boundaries for clarity) */
  dateWindow: {
    mode: "30d" | "90d" | "custom";
    startDate?: string;
    endDate?: string;
    resolvedStart: string; // YYYY-MM-DD
    resolvedEnd: string; // YYYY-MM-DD
  };

  /** Simple derived summaries to support picker display and quick audits */
  platformCounts: Record<ReviewInput["platform"], number>;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  responseCoverage: {
    total: number;
    responded: number;
    responseRatePct: number;
    hasNoResponses: boolean;
  };
  sentimentSummary: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
  themesSummary: {
    topThemeNames: string[];
  };

  /** Outputs (exact payload rendered) */
  request: ReputationDashboardRequest;
  response: ReputationDashboardResponse;

  /** Integrity */
  engineVersion: string;
  schemaVersion: string;
  inputDigest: {
    value: string;
    method: "rd-snapshotId";
  };
}

export function getSnapshotsStorageKey(businessId: string) {
  return `reputation:snapshots:${businessId}`;
}

export function getActiveSnapshotIdStorageKey(businessId: string) {
  return `reputation:activeSnapshotId:${businessId}`;
}

export function loadSnapshots(storage: Storage, businessId: string): ReputationSnapshot[] {
  try {
    const raw = storage.getItem(getSnapshotsStorageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ReputationSnapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshots(storage: Storage, businessId: string, snapshots: ReputationSnapshot[]) {
  storage.setItem(getSnapshotsStorageKey(businessId), JSON.stringify(snapshots));
}

export function loadActiveSnapshotId(storage: Storage, businessId: string): string | null {
  try {
    return storage.getItem(getActiveSnapshotIdStorageKey(businessId));
  } catch {
    return null;
  }
}

export function saveActiveSnapshotId(storage: Storage, businessId: string, snapshotId: string) {
  storage.setItem(getActiveSnapshotIdStorageKey(businessId), snapshotId);
}

export function addSnapshotAndPrune(
  storage: Storage,
  businessId: string,
  snapshot: ReputationSnapshot,
  cap = 20
): ReputationSnapshot[] {
  const existing = loadSnapshots(storage, businessId);
  const merged = [snapshot, ...existing].filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx);
  merged.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const pruned = merged.slice(0, cap);
  saveSnapshots(storage, businessId, pruned);
  saveActiveSnapshotId(storage, businessId, snapshot.id);
  return pruned;
}


