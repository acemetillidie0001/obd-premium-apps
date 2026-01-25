# Teams & Users — Tier 5C Audit Report (A–G)

**Scope:** Teams & Users (Business memberships + invites) — tenant safety, routing safety, determinism, resilience  
**Repo:** OBD Premium Apps

## Executive Summary

Teams & Users is **LOCK-eligible** based on:

- Membership-derived, deny-by-default tenant context resolution (never trusts raw `?businessId=`).
- Tenant-scoped team management APIs with role enforcement + “last owner” safety rules.
- Tokenized invites (hash stored, raw token never stored) with strict accept rules (email match + expiry + cancel/accept lifecycle).
- Demo mode blocks all mutations (read-only).
- Minimal audit logging for sensitive actions (tenant-scoped, no secrets).

## A–G Scorecard

| Category | Status | Notes |
| --- | --- | --- |
| A) Tenant safety | PASS | Membership-derived business context + tenant-scoped queries |
| B) Determinism | PASS | Deterministic membership selection + explicit lockout-prevention rules |
| C) No automation/background jobs | PASS | No email dependency; no cron/jobs; expiry evaluated at read-time |
| D) Export/apply integrity | N/A | Teams & Users is not an exporter and has no “apply-to-site” behavior |
| E) Tier 5A UX parity | PASS | Disabled-not-hidden controls + calm errors; consistent OBD components |
| F) Tier 5C routing safety | PASS | Invite accept is token+email gated; all management routes are membership-scoped |
| G) Resilience | PASS | Demo-mode read-only enforcement; transactional writes; calm API errors |

## Verification Commands

```shell
pnpm run typecheck
pnpm run vercel-build
```

---

## Evidence A — Tenant safety (membership-derived tenant, deny-by-default)

### A1) `requireBusinessContext()` derives tenant from ACTIVE membership (deny-by-default)

```45:108:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/auth/requireBusinessContext.ts
export async function requireBusinessContext(
  options: RequireBusinessContextOptions = {}
): Promise<BusinessContext> {
  const session = await auth();
  const userId = session?.user?.id;
  // ... membership lookup ...
  if (!memberships.length) {
    throw new BusinessContextError(
      "No active business membership found for this account.",
      403,
      "BUSINESS_MEMBERSHIP_REQUIRED"
    );
  }
  // ... selector only if membership matches ...
  const owner = memberships.find((m) => m.role === "OWNER");
  const picked = owner ?? memberships[0];
  return { userId, businessId: picked.businessId, role: picked.role };
}
```

### A2) Server resolver is deny-by-default + demo tenant override

```34:67:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/utils/resolve-business-id.server.ts
export async function resolveBusinessIdServer(
  cookieStore: CookieStore,
  searchParams?: URLSearchParams | null
): Promise<string | null> {
  if (hasDemoCookie(cookieStore)) {
    return getDemoBusinessId();
  }
  const requestedBusinessId = searchParams?.get("businessId")?.trim() || null;
  try {
    const ctx = await requireBusinessContext({ requestedBusinessId });
    return ctx.businessId;
  } catch (err) {
    return null;
  }
}
```

---

## Evidence B — Determinism (selection + lockout prevention)

### B1) Deterministic membership selection (oldest OWNER else oldest membership)

```55:107:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/auth/requireBusinessContext.ts
  memberships = await prisma.businessUser.findMany({
    where: { userId, status: "ACTIVE" },
    select: { businessId: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  // Oldest OWNER membership (deterministic because memberships are createdAt asc)
  const owner = memberships.find((m) => m.role === "OWNER");
  const picked = owner ?? memberships[0];
```

### B2) “Last active owner” safety rules enforced server-side (PATCH/DELETE members)

```112:143:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/members/route.ts
      const activeOwners = await tx.businessUser.count({
        where: { businessId: ctx.businessId, role: "OWNER", status: "ACTIVE" },
      });
      const isLastActiveOwner = activeOwners <= 1;
      const targetIsActiveOwner = membership.role === "OWNER" && membership.status === "ACTIVE";
      const targetIsSelf = targetUserId === ctx.userId;
      if (nextRole && targetIsActiveOwner && isLastActiveOwner) {
        throw new Error("LAST_OWNER_ROLE");
      }
      if (nextStatus === "SUSPENDED" && targetIsActiveOwner && isLastActiveOwner) {
        throw new Error("LAST_OWNER_SUSPEND");
      }
      if (targetIsSelf && isLastActiveOwner && ctx.role === "OWNER") {
        if (nextStatus === "SUSPENDED") throw new Error("SELF_LAST_OWNER_SUSPEND");
        if (nextRole) throw new Error("SELF_LAST_OWNER_ROLE");
      }
```

```254:266:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/members/route.ts
      const activeOwners = await tx.businessUser.count({
        where: { businessId: ctx.businessId, role: "OWNER", status: "ACTIVE" },
      });
      const isLastActiveOwner = activeOwners <= 1;
      const targetIsActiveOwner = membership.role === "OWNER" && membership.status === "ACTIVE";
      const targetIsSelf = targetUserId === ctx.userId;
      if (targetIsActiveOwner && isLastActiveOwner) throw new Error("LAST_OWNER_REMOVE");
      if (targetIsSelf && isLastActiveOwner && ctx.role === "OWNER") throw new Error("SELF_LAST_OWNER_REMOVE");
```

---

## Evidence C — No automation/background jobs (manual-only)

### C1) Invites are copy-link; no email automation dependency

```66:76:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/invites/route.ts
/**
 * POST /api/teams-users/invites
 * Owner/Admin only. Create an invite.
 *
 * Returns inviteLink for MVP (copy link UI). No email automation.
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
```

### C2) Expiry is checked at request-time (no cron)

```41:49:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/invites/route.ts
  const now = new Date();
  const invites = await prisma.teamInvite.findMany({
    where: {
      businessId: ctx.businessId,
      acceptedAt: null,
      canceledAt: null,
      expiresAt: { gt: now },
    },
```

---

## Evidence D — Export / Apply integrity

Teams & Users is not an exporter and has no “apply-to-site” behaviors. It only manages memberships/invites.

---

## Evidence E — Tier 5A UX parity (disabled-not-hidden + calm errors)

### E1) Permission-driven UI gating via canonical `canUser()` (no scattered role checks)

```95:113:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/teams-users/page.tsx
  // For security, invite tokens are only available at creation time.
  // We keep copyable links in memory for the current session only.
  const [inviteLinksById, setInviteLinksById] = useState<Record<string, string>>({});
  const myRoleRaw = myMember?.role ?? "STAFF";
  const myRole: TeamRole =
    myRoleRaw === "OWNER" || myRoleRaw === "ADMIN" || myRoleRaw === "STAFF" ? (myRoleRaw as TeamRole) : "STAFF";
  const canManageTeam = canUser(myRole, "TEAMS_USERS", "MANAGE_TEAM");
```

### E2) Disabled-not-hidden tooltips for Staff

```296:304:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/teams-users/page.tsx
  const staffTooltip =
    "Staff accounts can view the team, but only Owners/Admins can make changes.";
  const selfTooltip =
    "For safety, your own access can’t be changed here. Ask another owner/admin if you need a change.";
```

```402:427:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/teams-users/page.tsx
                      const disableManage = !canManageTeam || isSelf;
                      const manageTitle = !canManageTeam ? staffTooltip : isSelf ? selfTooltip : undefined;
                      // ...
                              <select
                                className={getInputClasses(isDark)}
                                value={m.role === "ADMIN" ? "ADMIN" : "STAFF"}
                                disabled={disableManage}
                                title={manageTitle}
                                onChange={(e) => updateMember(m.userId, { role: e.target.value as "ADMIN" | "STAFF" })}
                              >
```

---

## Evidence F — Tier 5C routing safety (invites + acceptance + membership scoping)

### F1) All management routes are membership-scoped + role enforced

```38:52:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/members/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedBusinessId = searchParams.get("businessId")?.trim() || null;
  let ctx;
  try {
    ctx = await requireBusinessContext({ requestedBusinessId });
  } catch (err) {
    // ... mapped to UNAUTHORIZED / FORBIDDEN / DB_UNAVAILABLE ...
  }
  const members = await prisma.businessUser.findMany({
    where: { businessId: ctx.businessId },
```

```92:101:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/invites/route.ts
  if (!isOwnerOrAdmin(ctx.role)) {
    return apiErrorResponse("Forbidden", "FORBIDDEN", 403);
  }
```

### F2) Invite accept is token-hash + email match gated (no businessId param)

```50:75:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/invites/accept/route.ts
  const token = parsed.data.token.trim();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await prisma.teamInvite.findFirst({ where: { tokenHash } });
  if (!invite) return apiErrorResponse("Invite not found", "NOT_FOUND", 404);
  // Enforce email match
  if (invite.email.trim().toLowerCase() !== email) {
    return apiErrorResponse("Invite email does not match your account", "FORBIDDEN", 403);
  }
```

---

## Evidence G — Resilience (demo mode, transactions, calm failures)

### G1) Demo mode blocks all mutations (standardized 403)

```72:87:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/demo/assert-not-demo.ts
export function assertNotDemoRequest(req: NextRequest): NextResponse | null {
  if (isDemoRequest(req)) {
    return NextResponse.json(
      { error: "DEMO_READ_ONLY", message: "Demo Mode is view-only." },
      { status: 403 }
    );
  }
  return null;
}
```

```79:84:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/members/route.ts
export async function PATCH(request: NextRequest) {
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;
```

### G2) Sensitive mutations are transactional and audit-logged (no secrets)

```112:181:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/teams-users/members/route.ts
    const updated = await prisma.$transaction(async (tx) => {
      // ... update membership ...
      if (nextRole && membership.role !== nextRole) {
        await tx.teamAuditLog.create({
          data: {
            businessId: ctx.businessId,
            actorUserId: ctx.userId,
            action: "MEMBER_ROLE_CHANGED",
            targetUserId,
            metaJson: { fromRole: membership.role, toRole: nextRole },
          },
        });
      }
      // ... status change audit ...
      return updated;
    });
```

### G3) Audit log schema is minimal and tenant-scoped

```77:88:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/prisma/schema.prisma
model TeamAuditLog {
  id          String   @id @default(cuid())
  businessId  String
  actorUserId String
  action      String
  targetUserId String?
  targetEmail  String?
  metaJson    Json?
  createdAt   DateTime @default(now())

  @@index([businessId, createdAt])
}
```

