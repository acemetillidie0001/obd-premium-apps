"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { TeamRole } from "@prisma/client";

import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDTableWrapper from "@/components/obd/OBDTableWrapper";
import OBDToast from "@/components/obd/OBDToast";
import type { OBDToastType } from "@/components/obd/toastTypes";
import { canUser, getRoleCapabilitySummary } from "@/lib/auth/permissions";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";

type Member = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "OWNER" | "ADMIN" | "STAFF" | string;
  status: "ACTIVE" | "SUSPENDED" | string;
  createdAt: string;
  lastActiveAt: string | null;
};

type Invite = {
  id: string;
  businessId: string;
  email: string;
  role: "ADMIN" | "STAFF" | string;
  expiresAt: string;
  createdAt: string;
  createdByUserId: string;
};

type AuditLogItem = {
  createdAt: string;
  action: string;
  actorUserId: string;
  targetUserId: string | null;
  targetEmail: string | null;
  metaJson: unknown | null;
};

type MembershipRole = "OWNER" | "ADMIN" | "STAFF";

const OWNER_PROMOTION_CONFIRM_TOKEN = "PROMOTE_TO_OWNER";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string; code: string; details?: unknown };

function isOk<T>(x: unknown): x is ApiOk<T> {
  return !!x && typeof x === "object" && (x as any).ok === true && "data" in (x as any);
}

function isErr(x: unknown): x is ApiErr {
  return !!x && typeof x === "object" && (x as any).ok === false && typeof (x as any).error === "string";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatExpiryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRoleLabel(role: unknown): string | null {
  if (role === "OWNER") return "Owner";
  if (role === "ADMIN") return "Admin";
  if (role === "STAFF") return "Staff";
  return typeof role === "string" && role.trim() ? role.trim() : null;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function TeamsUsersPageClient({ noBusinessFound }: { noBusinessFound?: boolean }) {
  const { theme, isDark, setTheme, toggleTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);

  const [toast, setToast] = useState<{ message: string; type: OBDToastType } | null>(null);
  const showToast = useCallback((message: string, type: OBDToastType) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For security, invite tokens are only available at creation time.
  // We keep copyable links in memory for the current session only.
  const [inviteLinksById, setInviteLinksById] = useState<Record<string, string>>({});

  // Owner promotion is an intentionally-confirmed action.
  const [roleOverrideByUserId, setRoleOverrideByUserId] = useState<Record<string, MembershipRole | undefined>>({});
  const [ownerPromotionConfirmByUserId, setOwnerPromotionConfirmByUserId] = useState<Record<string, string>>({});

  const myMember = useMemo(() => {
    if (!sessionUserId) return null;
    return members.find((m) => m.userId === sessionUserId) ?? null;
  }, [members, sessionUserId]);

  const myRoleRaw = myMember?.role ?? "STAFF";
  const myRole: TeamRole =
    myRoleRaw === "OWNER" || myRoleRaw === "ADMIN" || myRoleRaw === "STAFF" ? (myRoleRaw as TeamRole) : "STAFF";

  const canManageTeam = canUser(myRole, "TEAMS_USERS", "MANAGE_TEAM");

  const activeOwnerCount = useMemo(() => {
    return members.filter((m) => m.role === "OWNER" && m.status === "ACTIVE").length;
  }, [members]);

  const loadSession = useCallback(async () => {
    const res = await fetch("/api/debug/session", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as any;
    const user = data?.user ?? null;
    const id = user?.id ?? null;
    const email = user?.email ?? null;
    setSessionUserId(id);
    setSessionEmail(email);
    return { id, email };
  }, []);

  const loadBusinessName = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-profile", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as any;
      const name =
        json && typeof json === "object" && typeof json.businessName === "string" ? json.businessName.trim() : "";
      setBusinessName(name || null);
    } catch {
      setBusinessName(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = await loadSession();

      const [mRes, iRes] = await Promise.all([
        fetch("/api/teams-users/members", { cache: "no-store" }),
        fetch("/api/teams-users/invites", { cache: "no-store" }),
      ]);

      const mJson = await mRes.json().catch(() => null);
      const iJson = await iRes.json().catch(() => null);

      if (!mRes.ok) {
        const msg = isErr(mJson) ? mJson.error : "Failed to load team members.";
        throw new Error(msg);
      }
      if (!iRes.ok) {
        const msg = isErr(iJson) ? iJson.error : "Failed to load invitations.";
        throw new Error(msg);
      }

      if (!isOk<Member[]>(mJson)) throw new Error("Unexpected members response.");
      if (!isOk<Invite[]>(iJson)) throw new Error("Unexpected invites response.");

      const nextMembers = mJson.data;
      const nextInvites = iJson.data;
      setMembers(nextMembers);
      setInvites(nextInvites);
      // Best-effort business display name for invite messages (optional).
      void loadBusinessName();

      // Load audit log only for managers (Owner/Admin).
      // Compute capability from freshly fetched members (avoid stale role decisions).
      const my = sess?.id ? nextMembers.find((m) => m.userId === sess.id) ?? null : null;
      const roleRaw = my?.role ?? "STAFF";
      const role: TeamRole =
        roleRaw === "OWNER" || roleRaw === "ADMIN" || roleRaw === "STAFF" ? (roleRaw as TeamRole) : "STAFF";
      const canManage = canUser(role, "TEAMS_USERS", "MANAGE_TEAM");

      if (!canManage) {
        setAuditLogs([]);
        setAuditError(null);
        setAuditLoading(false);
      } else {
        setAuditLoading(true);
        setAuditError(null);
        try {
          const aRes = await fetch("/api/teams-users/audit", { cache: "no-store" });
          const aJson = await aRes.json().catch(() => null);
          if (!aRes.ok) {
            const msg = isErr(aJson) ? aJson.error : "Failed to load recent changes.";
            throw new Error(msg);
          }
          if (!isOk<AuditLogItem[]>(aJson)) throw new Error("Unexpected audit response.");
          setAuditLogs(aJson.data);
        } catch (err) {
          setAuditError(err instanceof Error ? err.message : "Failed to load recent changes.");
          setAuditLogs([]);
        } finally {
          setAuditLoading(false);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [loadBusinessName, loadSession]);

  useEffect(() => {
    if (noBusinessFound) {
      // UI guardrail: avoid calling tenant-scoped APIs when no business exists for this account.
      setLoading(false);
      setError(null);
      return;
    }
    loadAll();
  }, [loadAll, noBusinessFound]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteRefreshingId, setInviteRefreshingId] = useState<string | null>(null);

  const createInvite = useCallback(async () => {
    if (!canManageTeam) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast("Enter an email address to invite.", "warning");
      return;
    }

    setInviteCreating(true);
    try {
      const res = await fetch("/api/teams-users/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = isErr(json) ? json.error : "Failed to create invite.";
        throw new Error(msg);
      }
      if (!isOk<any>(json)) throw new Error("Unexpected invite response.");

      const created = json.data as { id: string; inviteLink: string; email: string; role: string; expiresAt: string };
      setInviteLinksById((prev) => ({ ...prev, [created.id]: created.inviteLink }));
      setInviteEmail("");
      showToast(`Invite created for ${created.email}.`, "success");
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create invite.", "error");
    } finally {
      setInviteCreating(false);
    }
  }, [canManageTeam, inviteEmail, inviteRole, loadAll, showToast]);

  const cancelInvite = useCallback(
    async (inviteId: string) => {
      if (!canManageTeam) return;
      try {
        const res = await fetch(`/api/teams-users/invites?id=${encodeURIComponent(inviteId)}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = isErr(json) ? json.error : "Failed to cancel invite.";
          throw new Error(msg);
        }
        showToast("Invite canceled.", "success");
        await loadAll();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to cancel invite.", "error");
      }
    },
    [canManageTeam, loadAll, showToast]
  );

  const refreshInviteLink = useCallback(
    async (inviteId: string, email: string) => {
      if (!canManageTeam) return;
      setInviteRefreshingId(inviteId);
      try {
        const res = await fetch("/api/teams-users/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, mode: "resend" }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = isErr(json) ? json.error : "Failed to refresh invite link.";
          throw new Error(msg);
        }
        if (!isOk<any>(json)) throw new Error("Unexpected resend response.");

        const updated = json.data as { id: string; inviteLink: string; email: string; expiresAt: string };
        setInviteLinksById((prev) => ({ ...prev, [updated.id]: updated.inviteLink }));
        showToast(`Invite link refreshed for ${updated.email}.`, "success");
        await loadAll();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to refresh invite link.", "error");
      } finally {
        setInviteRefreshingId(null);
      }
    },
    [canManageTeam, loadAll, showToast]
  );

  const updateMember = useCallback(
    async (
      targetUserId: string,
      patch: { role?: MembershipRole; status?: "ACTIVE" | "SUSPENDED"; confirm?: string }
    ) => {
      if (!canManageTeam) return;
      try {
        const res = await fetch("/api/teams-users/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: targetUserId, ...patch }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = isErr(json) ? json.error : "Update failed.";
          throw new Error(msg);
        }
        showToast("Member updated.", "success");
        await loadAll();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Update failed.", "error");
      }
    },
    [canManageTeam, loadAll, showToast]
  );

  const beginOwnerPromotion = useCallback((targetUserId: string) => {
    setRoleOverrideByUserId((prev) => ({ ...prev, [targetUserId]: "OWNER" }));
    setOwnerPromotionConfirmByUserId((prev) => ({ ...prev, [targetUserId]: "" }));
  }, []);

  const cancelOwnerPromotion = useCallback((targetUserId: string) => {
    setRoleOverrideByUserId((prev) => ({ ...prev, [targetUserId]: undefined }));
    setOwnerPromotionConfirmByUserId((prev) => ({ ...prev, [targetUserId]: "" }));
  }, []);

  const confirmOwnerPromotion = useCallback(
    async (targetUserId: string) => {
      const typed = ownerPromotionConfirmByUserId[targetUserId] ?? "";
      if (typed.trim() !== OWNER_PROMOTION_CONFIRM_TOKEN) {
        showToast(`Type ${OWNER_PROMOTION_CONFIRM_TOKEN} to confirm.`, "warning");
        return;
      }

      await updateMember(targetUserId, { role: "OWNER", confirm: OWNER_PROMOTION_CONFIRM_TOKEN });
      cancelOwnerPromotion(targetUserId);
    },
    [cancelOwnerPromotion, ownerPromotionConfirmByUserId, showToast, updateMember]
  );

  const removeMember = useCallback(
    async (targetUserId: string) => {
      if (!canManageTeam) return;
      try {
        const res = await fetch(`/api/teams-users/members?userId=${encodeURIComponent(targetUserId)}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = isErr(json) ? json.error : "Remove failed.";
          throw new Error(msg);
        }
        showToast("Member removed.", "success");
        await loadAll();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Remove failed.", "error");
      }
    },
    [canManageTeam, loadAll, showToast]
  );

  const staffTooltip =
    "Staff accounts can view the team, but only Owners/Admins can make changes.";

  const selfTooltip =
    "For safety, your own access can’t be changed here. Ask another owner/admin if you need a change.";

  const ownerPromotionTooltip =
    "Only an existing Owner can promote a teammate to Owner.";

  const ownerLockoutProtectionHelper = "Owners are protected to prevent account lockout.";

  const canPromoteToOwner = canManageTeam && myRole === "OWNER";

  const memberLabelByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      const label = (m.name && m.name.trim()) || (m.email && m.email.trim()) || m.userId;
      map.set(m.userId, label);
    }
    return map;
  }, [members]);

  const formatAuditLine = useCallback(
    (log: AuditLogItem): string => {
      const meta = log.metaJson && typeof log.metaJson === "object" ? (log.metaJson as any) : null;
      const targetEmail = log.targetEmail?.trim() || null;
      const targetUser = log.targetUserId ? memberLabelByUserId.get(log.targetUserId) ?? log.targetUserId : null;

      if (log.action === "INVITE_CREATED") {
        const role = formatRoleLabel(meta?.role) || "Staff";
        return `Invite created for ${targetEmail ?? "a teammate"} (${role})`;
      }
      if (log.action === "INVITE_RESENT") {
        return `Invite link refreshed for ${targetEmail ?? "a teammate"}`;
      }
      if (log.action === "INVITE_CANCELED") {
        return `Invite canceled for ${targetEmail ?? "a teammate"}`;
      }
      if (log.action === "INVITE_ACCEPTED") {
        return `Invite accepted by ${targetEmail ?? targetUser ?? "a teammate"}`;
      }
      if (log.action === "MEMBER_ROLE_CHANGED") {
        const fromRole = formatRoleLabel(meta?.fromRole) ?? "Staff";
        const toRole = formatRoleLabel(meta?.toRole) ?? "Staff";
        return `Role changed: ${fromRole} → ${toRole} for ${targetEmail ?? targetUser ?? "a teammate"}`;
      }
      if (log.action === "MEMBER_ROLE_UPDATED") {
        const fromRole = formatRoleLabel(meta?.fromRole) ?? "Staff";
        const toRole = formatRoleLabel(meta?.toRole) ?? "Staff";
        return `Role updated: ${fromRole} → ${toRole} for ${targetEmail ?? targetUser ?? "a teammate"}`;
      }
      if (log.action === "MEMBER_STATUS_UPDATED") {
        const fromStatus = typeof meta?.fromStatus === "string" ? meta.fromStatus : null;
        const toStatus = typeof meta?.toStatus === "string" ? meta.toStatus : null;
        const from = fromStatus === "ACTIVE" ? "Active" : fromStatus === "SUSPENDED" ? "Suspended" : fromStatus ?? "—";
        const to = toStatus === "ACTIVE" ? "Active" : toStatus === "SUSPENDED" ? "Suspended" : toStatus ?? "—";
        return `Status updated: ${from} → ${to} for ${targetEmail ?? targetUser ?? "a teammate"}`;
      }
      // Back-compat (older action names)
      if (log.action === "MEMBER_SUSPENDED") {
        return `Status updated: Active → Suspended for ${targetEmail ?? targetUser ?? "a teammate"}`;
      }
      if (log.action === "MEMBER_REACTIVATED") {
        return `Status updated: Suspended → Active for ${targetEmail ?? targetUser ?? "a teammate"}`;
      }
      if (log.action === "MEMBER_REMOVED") {
        return `Member removed: ${targetUser ?? "a teammate"}`;
      }

      return log.action.replace(/_/g, " ").toLowerCase();
    },
    [memberLabelByUserId]
  );

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={toggleTheme}
      title="Teams & Users"
      tagline="Invite teammates, manage roles, and keep access scoped to your business."
      theme={theme}
      onThemeChange={setTheme}
    >
      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-5 right-5 z-50">
          <OBDToast message={toast.message} type={toast.type} isDark={isDark} />
        </div>
      ) : null}

      {/* Hero / status */}
      <OBDPanel isDark={isDark} className="mt-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <OBDHeading level={2} isDark={isDark}>
              Teams & Users
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
              Your access is enforced at the API layer via memberships. This page gives you a calm, safe way to manage it.
            </p>
            <p className={`mt-2 text-xs ${themeClasses.mutedText}`}>
              Signed in as: <span className={themeClasses.headingText}>{sessionEmail ?? "…"}</span> · Role:{" "}
              <span className={themeClasses.headingText}>{myRoleRaw}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
              }`}
              disabled={!!noBusinessFound}
              title={noBusinessFound ? "Business required" : "Refresh"}
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className={`mt-5 rounded-lg border p-4 ${isDark ? "border-red-800/50 bg-red-950/20 text-red-200" : "border-red-200 bg-red-50 text-red-800"}`}>
            <div className="font-semibold mb-1">We couldn’t load your team.</div>
            <div className="text-sm">{error}</div>
          </div>
        ) : null}
      </OBDPanel>

      {/* Guardrail: no business for this account */}
      {noBusinessFound ? (
        <OBDPanel isDark={isDark} className="mt-7">
          <div className={`rounded-lg border p-4 ${isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <div className="font-semibold">No business found for this account.</div>
            <div className="mt-1 text-sm">Businesses must exist before teams can be managed.</div>
          </div>
        </OBDPanel>
      ) : null}

      {noBusinessFound ? null : (
        <>
          {/* Team Members */}
          <OBDPanel isDark={isDark} className="mt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <OBDHeading level={2} isDark={isDark} className="text-xl">
                  Team Members
                </OBDHeading>
                <p className={`mt-1 text-sm ${themeClasses.mutedText}`}>
                  Members can be Owners, Admins, or Staff. Only Owners/Admins can change access.
                </p>
                {!canPromoteToOwner ? (
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`} title={ownerPromotionTooltip}>
                    Owner promotions can only be done by an existing Owner.
                  </p>
                ) : null}
              </div>
              <div className={`text-xs ${themeClasses.mutedText}`}>
                Active owners: <span className={themeClasses.headingText}>{activeOwnerCount || 0}</span>
              </div>
            </div>

            {loading ? (
              <div className={`mt-6 text-sm ${themeClasses.mutedText}`}>Loading team members…</div>
            ) : members.length === 0 ? (
              <div className="mt-6">
                <div className="text-3xl mb-2">👤</div>
                <div className={`font-semibold ${themeClasses.headingText}`}>No members found</div>
                <div className={`mt-1 text-sm ${themeClasses.mutedText}`}>
                  Once your membership backfill runs, your account will appear here as the owner.
                </div>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="mt-6 hidden md:block">
                  <OBDTableWrapper>
                    <table className={`w-full text-sm ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      <thead>
                        <tr className={isDark ? "text-slate-300" : "text-slate-600"}>
                          <th className="text-left font-semibold py-2 pr-4">Member</th>
                          <th className="text-left font-semibold py-2 pr-4">Role</th>
                          <th className="text-left font-semibold py-2 pr-4">Status</th>
                          <th className="text-left font-semibold py-2 pr-4">Created</th>
                          <th className="text-left font-semibold py-2 pr-4">Last active</th>
                          <th className="text-right font-semibold py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-slate-800" : "divide-y divide-slate-200"}>
                        {members.map((m) => {
                          const isSelf = m.userId === sessionUserId;
                          const isOwner = m.role === "OWNER";
                          const isLastOwner = isOwner && m.status === "ACTIVE" && activeOwnerCount <= 1;

                          const disableManage = !canManageTeam || isSelf;
                          const manageTitle = !canManageTeam ? staffTooltip : isSelf ? selfTooltip : undefined;

                          const canSuspend = !disableManage && !(isLastOwner && m.status === "ACTIVE");
                          const canRemove = !disableManage && (!isOwner || activeOwnerCount > 1);

                          return (
                            <tr key={m.userId} className="align-top">
                              <td className="py-3 pr-4">
                                <div className="font-semibold">{m.name || "—"}</div>
                                <div className={`text-xs ${themeClasses.mutedText}`}>{m.email || "—"}</div>
                              </td>
                              <td className="py-3 pr-4">
                                {isOwner ? (
                                  <div className="inline-flex flex-col items-start gap-1">
                                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${
                                      isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-600/30 bg-emerald-50 text-emerald-700"
                                    }`}>
                                      OWNER
                                    </span>
                                    {isLastOwner ? (
                                      <div className={`text-xs ${themeClasses.mutedText}`}>{ownerLockoutProtectionHelper}</div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div>
                                    <select
                                      className={getInputClasses(isDark)}
                                      value={(roleOverrideByUserId[m.userId] ?? (m.role === "ADMIN" ? "ADMIN" : "STAFF")) as MembershipRole}
                                      disabled={disableManage}
                                      title={manageTitle}
                                      onChange={(e) => {
                                        const next = e.target.value as MembershipRole;
                                        if (next === "OWNER") {
                                          beginOwnerPromotion(m.userId);
                                          return;
                                        }
                                        cancelOwnerPromotion(m.userId);
                                        updateMember(m.userId, { role: next });
                                      }}
                                    >
                                      <option value="STAFF">STAFF</option>
                                      <option value="ADMIN">ADMIN</option>
                                      {canPromoteToOwner ? <option value="OWNER">OWNER</option> : null}
                                    </select>

                                    {roleOverrideByUserId[m.userId] === "OWNER" ? (
                                      <div
                                        className={`mt-2 rounded-lg border p-3 ${
                                          isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                                        }`}
                                      >
                                        <div className={`text-xs ${themeClasses.mutedText}`}>
                                          Type <span className={themeClasses.headingText}>{OWNER_PROMOTION_CONFIRM_TOKEN}</span> to confirm.
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <input
                                            value={ownerPromotionConfirmByUserId[m.userId] ?? ""}
                                            onChange={(e) =>
                                              setOwnerPromotionConfirmByUserId((prev) => ({
                                                ...prev,
                                                [m.userId]: e.target.value,
                                              }))
                                            }
                                            placeholder={OWNER_PROMOTION_CONFIRM_TOKEN}
                                            className={getInputClasses(isDark)}
                                            aria-label="Confirm owner promotion"
                                          />
                                          <button
                                            type="button"
                                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                                              (ownerPromotionConfirmByUserId[m.userId] ?? "").trim() === OWNER_PROMOTION_CONFIRM_TOKEN
                                                ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                                                : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                                            }`}
                                            disabled={(ownerPromotionConfirmByUserId[m.userId] ?? "").trim() !== OWNER_PROMOTION_CONFIRM_TOKEN}
                                            title="Confirms promoting this teammate to Owner."
                                            onClick={() => confirmOwnerPromotion(m.userId)}
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            type="button"
                                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                                              isDark ? "bg-slate-900 hover:bg-slate-800 text-slate-200" : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                                            }`}
                                            onClick={() => cancelOwnerPromotion(m.userId)}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${
                                  m.status === "ACTIVE"
                                    ? (isDark ? "border-slate-700 bg-slate-800 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")
                                    : (isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-amber-400/40 bg-amber-50 text-amber-800")
                                }`}>
                                  {m.status}
                                </span>
                              </td>
                              <td className={`py-3 pr-4 ${themeClasses.mutedText}`}>{formatDate(m.createdAt)}</td>
                              <td className={`py-3 pr-4 ${themeClasses.mutedText}`}>{formatDate(m.lastActiveAt)}</td>
                              <td className="py-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                      canSuspend
                                        ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                                        : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                                    }`}
                                    disabled={!canSuspend}
                                    title={
                                      !canManageTeam
                                        ? staffTooltip
                                        : isSelf
                                          ? selfTooltip
                                          : isLastOwner
                                            ? ownerLockoutProtectionHelper
                                            : undefined
                                    }
                                    onClick={() =>
                                      updateMember(m.userId, { status: m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })
                                    }
                                  >
                                    {m.status === "ACTIVE" ? "Suspend" : "Re-activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                      canRemove
                                        ? (isDark ? "bg-red-950/40 hover:bg-red-950/60 text-red-200 border border-red-900/40" : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200")
                                        : (isDark ? "bg-slate-900 text-slate-600 border border-slate-800" : "bg-slate-100 text-slate-400 border border-slate-200")
                                    }`}
                                    disabled={!canRemove}
                                    title={
                                      !canManageTeam
                                        ? staffTooltip
                                        : isSelf
                                          ? selfTooltip
                                          : isOwner && activeOwnerCount <= 1
                                            ? ownerLockoutProtectionHelper
                                            : undefined
                                    }
                                    onClick={() => removeMember(m.userId)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </OBDTableWrapper>
                </div>

                {/* Mobile cards */}
                <div className="mt-6 grid grid-cols-1 gap-3 md:hidden">
                  {members.map((m) => {
                    const isSelf = m.userId === sessionUserId;
                    const isOwner = m.role === "OWNER";
                    const isLastOwner = isOwner && m.status === "ACTIVE" && activeOwnerCount <= 1;

                    const disableManage = !canManageTeam || isSelf;
                    const manageTitle = !canManageTeam ? staffTooltip : isSelf ? selfTooltip : undefined;

                    const canSuspend = !disableManage && !(isLastOwner && m.status === "ACTIVE");
                    const canRemove = !disableManage && (!isOwner || activeOwnerCount > 1);

                    return (
                      <div
                        key={m.userId}
                        className={`rounded-xl border p-4 ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`font-semibold ${themeClasses.headingText}`}>{m.name || "—"}</div>
                            <div className={`text-xs ${themeClasses.mutedText}`}>{m.email || "—"}</div>
                          </div>
                          <div className={`text-xs ${themeClasses.mutedText}`}>{m.role}</div>
                        </div>

                        {isLastOwner ? (
                          <div className={`mt-2 text-xs ${themeClasses.mutedText}`}>{ownerLockoutProtectionHelper}</div>
                        ) : null}

                        <div className={`mt-3 text-xs ${themeClasses.mutedText}`}>
                          Status: <span className={themeClasses.headingText}>{m.status}</span>
                        </div>
                        <div className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                          Created: <span className={themeClasses.headingText}>{formatDate(m.createdAt)}</span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {!isOwner ? (
                            <select
                              className={getInputClasses(isDark)}
                              value={(roleOverrideByUserId[m.userId] ?? (m.role === "ADMIN" ? "ADMIN" : "STAFF")) as MembershipRole}
                              disabled={disableManage}
                              title={manageTitle}
                              onChange={(e) => {
                                const next = e.target.value as MembershipRole;
                                if (next === "OWNER") {
                                  beginOwnerPromotion(m.userId);
                                  return;
                                }
                                cancelOwnerPromotion(m.userId);
                                updateMember(m.userId, { role: next });
                              }}
                            >
                              <option value="STAFF">STAFF</option>
                              <option value="ADMIN">ADMIN</option>
                              {canPromoteToOwner ? <option value="OWNER">OWNER</option> : null}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                                isDark ? "bg-slate-900 text-slate-500" : "bg-slate-100 text-slate-400"
                              }`}
                              disabled
                              title={ownerLockoutProtectionHelper}
                            >
                              OWNER
                            </button>
                          )}

                          <button
                            type="button"
                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                              canSuspend
                                ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                                : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                            }`}
                            disabled={!canSuspend}
                            title={
                              !canManageTeam
                                ? staffTooltip
                                : isSelf
                                  ? selfTooltip
                                  : isLastOwner
                                    ? ownerLockoutProtectionHelper
                                    : undefined
                            }
                            onClick={() => updateMember(m.userId, { status: m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
                          >
                            {m.status === "ACTIVE" ? "Suspend" : "Re-activate"}
                          </button>
                        </div>

                        {roleOverrideByUserId[m.userId] === "OWNER" ? (
                          <div
                            className={`mt-2 rounded-lg border p-3 ${
                              isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className={`text-xs ${themeClasses.mutedText}`}>
                              Type <span className={themeClasses.headingText}>{OWNER_PROMOTION_CONFIRM_TOKEN}</span> to confirm.
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                value={ownerPromotionConfirmByUserId[m.userId] ?? ""}
                                onChange={(e) =>
                                  setOwnerPromotionConfirmByUserId((prev) => ({
                                    ...prev,
                                    [m.userId]: e.target.value,
                                  }))
                                }
                                placeholder={OWNER_PROMOTION_CONFIRM_TOKEN}
                                className={getInputClasses(isDark)}
                                aria-label="Confirm owner promotion"
                              />
                              <button
                                type="button"
                                className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                                  (ownerPromotionConfirmByUserId[m.userId] ?? "").trim() === OWNER_PROMOTION_CONFIRM_TOKEN
                                    ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                                    : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                                }`}
                                disabled={(ownerPromotionConfirmByUserId[m.userId] ?? "").trim() !== OWNER_PROMOTION_CONFIRM_TOKEN}
                                title="Confirms promoting this teammate to Owner."
                                onClick={() => confirmOwnerPromotion(m.userId)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                                  isDark ? "bg-slate-900 hover:bg-slate-800 text-slate-200" : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                                }`}
                                onClick={() => cancelOwnerPromotion(m.userId)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-2">
                          <button
                            type="button"
                            className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition ${
                              canRemove
                                ? (isDark ? "bg-red-950/40 hover:bg-red-950/60 text-red-200 border border-red-900/40" : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200")
                                : (isDark ? "bg-slate-900 text-slate-600 border border-slate-800" : "bg-slate-100 text-slate-400 border border-slate-200")
                            }`}
                            disabled={!canRemove}
                            title={
                              !canManageTeam
                                ? staffTooltip
                                : isSelf
                                  ? selfTooltip
                                  : isOwner && activeOwnerCount <= 1
                                    ? ownerLockoutProtectionHelper
                                    : undefined
                            }
                            onClick={() => removeMember(m.userId)}
                          >
                            Remove Member
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </OBDPanel>

          {/* Invitations */}
          <OBDPanel isDark={isDark} className="mt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <OBDHeading level={2} isDark={isDark} className="text-xl">
                  Invitations
                </OBDHeading>
                <p className={`mt-1 text-sm ${themeClasses.mutedText}`}>
                  Create a secure invite link and share it with a teammate. Invites expire automatically.
                </p>
              </div>
            </div>

            {/* Create invite */}
            <div className={`mt-5 rounded-xl border p-4 ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"}`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>Email</label>
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@domain.com"
                    className={getInputClasses(isDark)}
                    disabled={!canManageTeam}
                    title={!canManageTeam ? staffTooltip : undefined}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "STAFF" | "ADMIN")}
                    className={getInputClasses(isDark)}
                    disabled={!canManageTeam}
                    title={!canManageTeam ? staffTooltip : undefined}
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button
                    type="button"
                    className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                      canManageTeam
                        ? (isDark ? "bg-[#29c4a9] hover:bg-[#22ad93] text-white" : "bg-[#29c4a9] hover:bg-[#22ad93] text-white")
                        : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                    }`}
                    onClick={createInvite}
                    disabled={!canManageTeam || inviteCreating}
                    title={!canManageTeam ? staffTooltip : undefined}
                  >
                    {inviteCreating ? "Creating…" : "Create Invite"}
                  </button>
                </div>
              </div>

              <p className={`mt-3 text-xs ${themeClasses.mutedText}`}>
                Note: for security, invite links are only shown when you create or refresh them. Older invites can be canceled here, but their token can’t be re-shown without refreshing.
              </p>
            </div>

            {/* Pending invites list */}
            {loading ? (
              <div className={`mt-6 text-sm ${themeClasses.mutedText}`}>Loading invitations…</div>
            ) : invites.length === 0 ? (
              <div className="mt-6">
                <div className="text-3xl mb-2">📨</div>
                <div className={`font-semibold ${themeClasses.headingText}`}>No pending invitations</div>
                <div className={`mt-1 text-sm ${themeClasses.mutedText}`}>
                  When you invite someone, it will show up here until it’s accepted, canceled, or expired.
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {invites.map((i) => {
                  const link = inviteLinksById[i.id] ?? null;
                  const canCopy = !!link;
                  const copyTitle = canCopy
                    ? "Copy invite link"
                    : "For security, invite links are only shown once at creation time.";
                  const canCopyMessage = !!link;
                  const copyMessageTitle = canCopyMessage
                    ? "Copy a ready-to-send invite message"
                    : "Refresh link to generate a new link you can copy.";
                  const refreshTitle = !canManageTeam
                    ? staffTooltip
                    : "Refresh link (rotates token + extends expiration)";

                  const expiresAtMs = new Date(i.expiresAt).getTime();
                  const msRemaining = Number.isFinite(expiresAtMs) ? expiresAtMs - Date.now() : Number.NaN;
                  const expiresSoon = Number.isFinite(msRemaining) && msRemaining > 0 && msRemaining < 48 * 60 * 60 * 1000;

                  const inviteAccountLabel = businessName?.trim() || "your OBD account";
                  const inviteMessage = link
                    ? [
                        `Hi! You’ve been invited to join ${inviteAccountLabel} on OBD.`,
                        "",
                        `Accept invite: ${link}`,
                      ].join("\n")
                    : null;

                  return (
                    <div
                      key={i.id}
                      className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
                        isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`font-semibold ${themeClasses.headingText}`}>{i.email}</div>
                        <div className={`text-xs ${themeClasses.mutedText}`}>
                          Role: <span className={themeClasses.headingText}>{i.role}</span> · Expires:{" "}
                          <span className={themeClasses.headingText}>{formatExpiryDate(i.expiresAt)}</span>
                        </div>
                        {expiresSoon ? (
                          <div className={`mt-1 text-xs ${themeClasses.mutedText}`}>Expires soon</div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            canCopyMessage
                              ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                              : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                          }`}
                          disabled={!canCopyMessage}
                          title={copyMessageTitle}
                          onClick={async () => {
                            if (!inviteMessage) return;
                            const ok = await copyToClipboard(inviteMessage);
                            showToast(ok ? "Message copied." : "Couldn’t copy message. Please copy manually.", ok ? "success" : "warning");
                          }}
                        >
                          Copy invite message
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            canCopy
                              ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                              : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                          }`}
                          disabled={!canCopy}
                          title={copyTitle}
                          onClick={async () => {
                            if (!link) return;
                            const ok = await copyToClipboard(link);
                            showToast(ok ? "Invite link copied." : "Couldn’t copy link. Please copy manually.", ok ? "success" : "warning");
                          }}
                        >
                          Copy invite link
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            canManageTeam
                              ? (isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
                              : (isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400")
                          }`}
                          disabled={!canManageTeam || inviteRefreshingId === i.id}
                          title={refreshTitle}
                          onClick={() => refreshInviteLink(i.id, i.email)}
                        >
                          {inviteRefreshingId === i.id ? "Refreshing…" : "Refresh link"}
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                            canManageTeam
                              ? (isDark ? "bg-red-950/40 hover:bg-red-950/60 text-red-200 border border-red-900/40" : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200")
                              : (isDark ? "bg-slate-900 text-slate-600 border border-slate-800" : "bg-slate-100 text-slate-400 border border-slate-200")
                          }`}
                          disabled={!canManageTeam}
                          title={!canManageTeam ? staffTooltip : "Cancel invite"}
                          onClick={() => cancelInvite(i.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </OBDPanel>

          {/* Roles & Access */}
          <OBDPanel isDark={isDark} className="mt-7">
            <OBDHeading level={2} isDark={isDark} className="text-xl">
              Roles & Access
            </OBDHeading>
            <div className={`mt-3 text-sm ${themeClasses.mutedText} space-y-3`}>
              <p>
                <span className={themeClasses.headingText}>Owner</span> can manage all users and invites. Owners are protected from being removed or suspended if it would lock the business.
              </p>
              <p>
                <span className={themeClasses.headingText}>Admin</span> can manage team members (roles/status) and invites. Billing and subscription controls are intentionally excluded.
              </p>
              <p>
                <span className={themeClasses.headingText}>Staff</span> is view-only. You’ll still see all controls, but they’ll be disabled with a clear tooltip so nothing is “mysteriously missing.”
              </p>
              <p className="text-xs">
                Infrastructure note: business scope is enforced server-side via `BusinessUser` membership. UI is a convenience layer, not the source of truth.
              </p>
            </div>
          </OBDPanel>

          {/* Role capabilities (read-only summary; not per-app granular) */}
          <OBDPanel isDark={isDark} className="mt-7">
            <OBDHeading level={2} isDark={isDark} className="text-xl">
              Role capabilities
            </OBDHeading>
            <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
              Summary view based on the current permission matrix. This is not app-by-app.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className={`w-full text-sm ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                <thead>
                  <tr className={isDark ? "text-slate-300" : "text-slate-600"}>
                    <th className="text-left font-semibold py-2 pr-4">Role</th>
                    <th className="text-center font-semibold py-2 px-2">View</th>
                    <th className="text-center font-semibold py-2 px-2">Create drafts</th>
                    <th className="text-center font-semibold py-2 px-2">Edit drafts</th>
                    <th className="text-center font-semibold py-2 px-2">Apply</th>
                    <th className="text-center font-semibold py-2 px-2">Export</th>
                    <th className="text-center font-semibold py-2 px-2">Manage team</th>
                    <th className="text-center font-semibold py-2 pl-2">Manage settings</th>
                  </tr>
                </thead>
                <tbody className={isDark ? "divide-y divide-slate-800" : "divide-y divide-slate-200"}>
                  {(["OWNER", "ADMIN", "STAFF"] as const).map((role) => {
                    const caps = getRoleCapabilitySummary(role);
                    const mark = (ok: boolean) => (ok ? "✓" : "—");

                    return (
                      <tr key={role}>
                        <td className="py-3 pr-4 font-semibold">{formatRoleLabel(role) ?? role}</td>
                        <td className="py-3 px-2 text-center" aria-label={`${role} can view`}>
                          {mark(caps.view)}
                        </td>
                        <td className="py-3 px-2 text-center" aria-label={`${role} can create drafts`}>
                          {mark(caps.createDrafts)}
                        </td>
                        <td className="py-3 px-2 text-center" aria-label={`${role} can edit drafts`}>
                          {mark(caps.editDrafts)}
                        </td>
                        <td className="py-3 px-2 text-center" aria-label={`${role} can apply`}>
                          {mark(caps.apply)}
                        </td>
                        <td className="py-3 px-2 text-center" aria-label={`${role} can export`}>
                          {mark(caps.export)}
                        </td>
                        <td className="py-3 px-2 text-center" aria-label={`${role} can manage team`}>
                          {mark(caps.manageTeam)}
                        </td>
                        <td className="py-3 pl-2 text-center" aria-label={`${role} can manage settings`}>
                          {mark(caps.manageSettings)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </OBDPanel>

          {/* Safety & trust */}
          <OBDPanel isDark={isDark} className="mt-7">
            <OBDHeading level={2} isDark={isDark} className="text-xl">
              Safety &amp; trust
            </OBDHeading>
            <ul className={`mt-3 text-sm ${themeClasses.mutedText} space-y-2 list-disc pl-5`}>
              <li>Access is scoped to this business only.</li>
              <li>Invites expire and can be canceled.</li>
              <li>Sensitive access changes are logged.</li>
              <li>No shared accounts.</li>
              <li>Roles use deny-by-default permissions.</li>
            </ul>
          </OBDPanel>

          {/* Recent changes */}
          {canManageTeam ? (
            <OBDPanel isDark={isDark} className="mt-7">
              <OBDHeading level={2} isDark={isDark} className="text-xl">
                Recent changes
              </OBDHeading>
              <p className={`mt-1 text-sm ${themeClasses.mutedText}`}>
                A lightweight audit trail of team access changes for this business.
              </p>

              {auditLoading ? (
                <div className={`mt-5 text-sm ${themeClasses.mutedText}`}>Loading recent changes…</div>
              ) : auditError ? (
                <div
                  className={`mt-5 rounded-lg border p-4 ${
                    isDark ? "border-red-800/50 bg-red-950/20 text-red-200" : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  <div className="font-semibold mb-1">We couldn’t load recent changes.</div>
                  <div className="text-sm">{auditError}</div>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="mt-5">
                  <div className={`text-sm ${themeClasses.mutedText}`}>No recent access changes yet.</div>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={`${log.createdAt}-${log.action}-${log.actorUserId}-${log.targetUserId ?? log.targetEmail ?? ""}`}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className={`${themeClasses.mutedText}`}>{formatDate(log.createdAt)}</span>
                      <span className={`${themeClasses.mutedText}`}>{" \u2022 "}</span>
                      <span className={themeClasses.headingText}>{formatAuditLine(log)}</span>
                    </div>
                  ))}
                </div>
              )}
            </OBDPanel>
          ) : null}
        </>
      )}
    </OBDPageContainer>
  );
}

