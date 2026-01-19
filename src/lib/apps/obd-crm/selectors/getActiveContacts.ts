import type { CrmContact, CrmContactStatus } from "@/lib/apps/obd-crm/types";

export type CrmFollowUpBucket = "overdue" | "today" | "upcoming" | "none";
export type CrmFollowUpBucketFilter = "all" | CrmFollowUpBucket;

export type CrmContactsSortKey = "updatedAt" | "createdAt" | "name" | "lastTouchAt" | "nextFollowUpAt";
export type CrmSortOrder = "asc" | "desc";

export type CrmContactsFiltersInput = {
  search?: string;
  status?: CrmContactStatus | "";
  tagId?: string;
  followUp?: "all" | "dueToday" | "overdue" | "upcoming" | "none";
  notes?: "all" | "withNotes";
};

export type CrmContactsSortInput = {
  key?: CrmContactsSortKey | string;
  order?: CrmSortOrder | string;
};

export type CrmContactsNormalizedFilters = {
  search: string;
  status: CrmContactStatus | null;
  tagId: string | null;
  followUp: CrmFollowUpBucketFilter;
  notes: "all" | "withNotes";
};

export type CrmContactsNormalizedSort = {
  key: CrmContactsSortKey;
  order: CrmSortOrder;
};

export type CrmFollowUpBucketCounts = Record<CrmFollowUpBucket, number>;

export type CrmContactsSelectorResult = {
  activeContacts: CrmContact[];
  // Buckets computed AFTER base filters (search/status/tag), BEFORE follow-up filter
  buckets: Record<CrmFollowUpBucket, CrmContact[]>;
  // Buckets computed AFTER all filters (including follow-up filter); useful for queue/table consistency
  activeBuckets: Record<CrmFollowUpBucket, CrmContact[]>;
  counts: {
    total: number; // raw contacts length
    filtered: number; // after applying filters (including follow-up filter)
    followUpBuckets: CrmFollowUpBucketCounts; // buckets computed AFTER base filters (search/status/tag), BEFORE follow-up filter
    notes: {
      withNotes: number; // based on lastTouchAt/lastNote presence within base filters
      noNotes: number;
    };
  };
  normalizedFilters: CrmContactsNormalizedFilters;
  normalizedSort: CrmContactsNormalizedSort;
  referenceTime: Date; // stable timestamp passed in
  todayWindow: { startOfToday: Date; endOfToday: Date };
};

function normalizeSearch(input: unknown): string {
  const v = typeof input === "string" ? input.trim() : "";
  return v;
}

function normalizeStatus(input: unknown): CrmContactStatus | null {
  if (input === "Lead" || input === "Active" || input === "Past" || input === "DoNotContact") return input;
  return null;
}

function normalizeTagId(input: unknown): string | null {
  const v = typeof input === "string" ? input.trim() : "";
  return v ? v : null;
}

function normalizeFollowUpFilter(input: unknown): CrmFollowUpBucketFilter {
  // Backward-compatible with existing UI string ("dueToday")
  if (input === "dueToday") return "today";
  if (input === "overdue" || input === "today" || input === "upcoming" || input === "none") return input;
  return "all";
}

function normalizeNotesFilter(input: unknown): "all" | "withNotes" {
  return input === "withNotes" ? "withNotes" : "all";
}

function normalizeSort(input: CrmContactsSortInput | undefined): CrmContactsNormalizedSort {
  const key = input?.key;
  const order = input?.order;

  const normalizedKey: CrmContactsSortKey =
    key === "createdAt" || key === "name" || key === "lastTouchAt" || key === "nextFollowUpAt"
      ? key
      : "updatedAt";

  const normalizedOrder: CrmSortOrder = order === "asc" ? "asc" : "desc";

  return { key: normalizedKey, order: normalizedOrder };
}

function toTimeOrNull(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  return Number.isFinite(t) ? t : null;
}

function getStartOfToday(referenceTime: Date): Date {
  return new Date(referenceTime.getFullYear(), referenceTime.getMonth(), referenceTime.getDate(), 0, 0, 0, 0);
}

function getEndOfToday(referenceTime: Date): Date {
  return new Date(referenceTime.getFullYear(), referenceTime.getMonth(), referenceTime.getDate(), 23, 59, 59, 999);
}

export function getFollowUpBucket(
  nextFollowUpAt: string | null | undefined,
  todayWindow: { startOfToday: Date; endOfToday: Date }
): CrmFollowUpBucket {
  const t = toTimeOrNull(nextFollowUpAt);
  if (t === null) return "none";
  if (t < todayWindow.startOfToday.getTime()) return "overdue";
  if (t <= todayWindow.endOfToday.getTime()) return "today";
  return "upcoming";
}

export function getActiveContacts({
  contacts,
  filters,
  sort,
  referenceTime,
}: {
  contacts: CrmContact[];
  filters: CrmContactsFiltersInput;
  sort?: CrmContactsSortInput;
  referenceTime: Date;
}): CrmContactsSelectorResult {
  const normalizedFilters: CrmContactsNormalizedFilters = {
    search: normalizeSearch(filters.search),
    status: normalizeStatus(filters.status),
    tagId: normalizeTagId(filters.tagId),
    followUp: normalizeFollowUpFilter(filters.followUp),
    notes: normalizeNotesFilter(filters.notes),
  };

  const normalizedSort = normalizeSort(sort);

  const todayWindow = {
    startOfToday: getStartOfToday(referenceTime),
    endOfToday: getEndOfToday(referenceTime),
  };

  // Base filtering: search + status + tag (these should affect bucket counts)
  const baseFiltered = contacts.filter((contact) => {
    // Search (matches name/email/phone)
    if (normalizedFilters.search) {
      const searchTerm = normalizedFilters.search;
      const searchLower = searchTerm.toLowerCase();
      const matches =
        contact.name.toLowerCase().includes(searchLower) ||
        (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
        (contact.phone && contact.phone.includes(searchTerm));
      if (!matches) return false;
    }

    if (normalizedFilters.status && contact.status !== normalizedFilters.status) return false;

    if (normalizedFilters.tagId) {
      const hasTag = contact.tags?.some((t) => t.id === normalizedFilters.tagId);
      if (!hasTag) return false;
    }

    if (normalizedFilters.notes === "withNotes") {
      const hasNotes = !!contact.lastTouchAt || !!contact.lastNote;
      if (!hasNotes) return false;
    }

    return true;
  });

  // Deterministic buckets (computed from baseFiltered only; used for counters)
  const buckets: Record<CrmFollowUpBucket, CrmContact[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    none: [],
  };

  // Notes counts (computed from baseFiltered only; used for snapshots)
  let withNotes = 0;
  let noNotes = 0;

  for (const c of baseFiltered) {
    const hasNotes = !!c.lastTouchAt || !!c.lastNote;
    if (hasNotes) withNotes++;
    else noNotes++;

    const bucket = getFollowUpBucket(c.nextFollowUpAt, todayWindow);
    buckets[bucket].push(c);
  }

  const followUpBuckets: CrmFollowUpBucketCounts = {
    overdue: buckets.overdue.length,
    today: buckets.today.length,
    upcoming: buckets.upcoming.length,
    none: buckets.none.length,
  };

  // Apply follow-up filter AFTER base filtering
  const followUpFiltered =
    normalizedFilters.followUp === "all"
      ? baseFiltered
      : baseFiltered.filter((c) => getFollowUpBucket(c.nextFollowUpAt, todayWindow) === normalizedFilters.followUp);

  const activeBuckets: Record<CrmFollowUpBucket, CrmContact[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    none: [],
  };
  for (const c of followUpFiltered) {
    activeBuckets[getFollowUpBucket(c.nextFollowUpAt, todayWindow)].push(c);
  }

  // Sorting (stable, deterministic)
  const dir = normalizedSort.order === "asc" ? 1 : -1;
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

  const sorted = [...followUpFiltered].sort((a, b) => {
    const key = normalizedSort.key;

    if (key === "name") {
      const cmp = collator.compare(a.name, b.name);
      if (cmp !== 0) return cmp * dir;
    } else if (key === "createdAt") {
      const at = toTimeOrNull(a.createdAt) ?? 0;
      const bt = toTimeOrNull(b.createdAt) ?? 0;
      if (at !== bt) return (at - bt) * dir;
    } else if (key === "updatedAt") {
      const at = toTimeOrNull(a.updatedAt) ?? 0;
      const bt = toTimeOrNull(b.updatedAt) ?? 0;
      if (at !== bt) return (at - bt) * dir;
    } else if (key === "lastTouchAt") {
      const at = toTimeOrNull(a.lastTouchAt) ?? -Infinity;
      const bt = toTimeOrNull(b.lastTouchAt) ?? -Infinity;
      if (at !== bt) return (at - bt) * dir;
    } else if (key === "nextFollowUpAt") {
      const at = toTimeOrNull(a.nextFollowUpAt) ?? Infinity;
      const bt = toTimeOrNull(b.nextFollowUpAt) ?? Infinity;
      if (at !== bt) return (at - bt) * dir;
    }

    // Tie-breaker: stable by id
    return a.id.localeCompare(b.id);
  });

  return {
    activeContacts: sorted,
    buckets,
    activeBuckets,
    counts: {
      total: contacts.length,
      filtered: sorted.length,
      followUpBuckets,
      notes: { withNotes, noNotes },
    },
    normalizedFilters,
    normalizedSort,
    referenceTime,
    todayWindow,
  };
}


