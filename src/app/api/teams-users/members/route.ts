import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { unauthorized } from "@/lib/http/errors";

export const runtime = "nodejs";

type MemberRow = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt: string | null;
};

const PatchSchema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["OWNER", "ADMIN", "STAFF"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    confirm: z.string().optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: "At least one of role or status must be provided",
  });

/**
 * GET /api/teams-users/members
 * List members for the resolved business.
 */
export async function GET(request: NextRequest) {
  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId } = await requireTenant();

    const members = await prisma.businessUser.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const result: MemberRow[] = members.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? null,
      email: m.user?.email ?? null,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      lastActiveAt: m.lastActiveAt ? m.lastActiveAt.toISOString() : null,
    }));

    return apiSuccessResponse(result);
  } catch (err) {
    if (err instanceof BusinessContextError) {
      return err.toHttpResponse();
    }
    return unauthorized();
  }
}

/**
 * PATCH /api/teams-users/members
 * Owner/Admin only. Update member role (OWNER/ADMIN/STAFF) and/or status (ACTIVE/SUSPENDED).
 */
export async function PATCH(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  warnIfBusinessIdParamPresent(request);

  let ctx;
  try {
    ctx = await requireTenant();
    await requirePermission("TEAMS_USERS", "MANAGE_TEAM");
  } catch (err) {
    if (err instanceof BusinessContextError) {
      return err.toHttpResponse();
    }
    return unauthorized();
  }

  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { userId: targetUserId, role: nextRole, status: nextStatus, confirm } = parsed.data;

  // Owner promotions require additional safeguards.
  if (nextRole === "OWNER") {
    // Only an OWNER can promote someone to OWNER (ADMIN cannot).
    if (ctx.role !== "OWNER") {
      return apiErrorResponse("Only an Owner can promote a teammate to Owner.", "FORBIDDEN", 403);
    }

    // Calm, explicit confirmation step to avoid accidental ownership transfers.
    if (confirm !== "PROMOTE_TO_OWNER") {
      return apiErrorResponse(
        'To promote someone to Owner, include confirm: "PROMOTE_TO_OWNER".',
        "VALIDATION_ERROR",
        400
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const membership = await tx.businessUser.findUnique({
        where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
      });

      if (!membership) {
        throw new Error("NOT_FOUND");
      }

      const activeOwners = await tx.businessUser.count({
        where: { businessId: ctx.businessId, role: "OWNER", status: "ACTIVE" },
      });
      const isLastActiveOwner = activeOwners <= 1;
      const targetIsActiveOwner = membership.role === "OWNER" && membership.status === "ACTIVE";
      const targetIsSelf = targetUserId === ctx.userId;

      // Cannot demote the last ACTIVE owner
      if (nextRole && targetIsActiveOwner && isLastActiveOwner) {
        throw new Error("LAST_OWNER_ROLE");
      }

      // Cannot suspend the last ACTIVE owner
      if (nextStatus === "SUSPENDED" && targetIsActiveOwner && isLastActiveOwner) {
        throw new Error("LAST_OWNER_SUSPEND");
      }

      // Cannot suspend/demote yourself if you're the last ACTIVE owner
      if (targetIsSelf && isLastActiveOwner && ctx.role === "OWNER") {
        if (nextStatus === "SUSPENDED") throw new Error("SELF_LAST_OWNER_SUSPEND");
        if (nextRole) throw new Error("SELF_LAST_OWNER_ROLE");
      }

      const updated = await tx.businessUser.update({
        where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
        data: {
          ...(nextRole ? { role: nextRole } : {}),
          ...(nextStatus ? { status: nextStatus } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit logs (minimal; no secrets). Only log changes that actually occurred.
      if (nextRole && membership.role !== nextRole) {
        const targetEmail = updated.user?.email?.trim() || null;
        await tx.teamAuditLog.create({
          data: {
            businessId: ctx.businessId,
            actorUserId: ctx.userId,
            action: "MEMBER_ROLE_CHANGED",
            targetUserId,
            ...(targetEmail ? { targetEmail } : {}),
            metaJson: { fromRole: membership.role, toRole: nextRole, ...(targetEmail ? { targetEmail } : {}) },
          },
        });
      }

      if (nextStatus && membership.status !== nextStatus) {
        await tx.teamAuditLog.create({
          data: {
            businessId: ctx.businessId,
            actorUserId: ctx.userId,
            action: nextStatus === "SUSPENDED" ? "MEMBER_SUSPENDED" : "MEMBER_REACTIVATED",
            targetUserId,
            metaJson: { fromStatus: membership.status, toStatus: nextStatus },
          },
        });
      }

      return updated;
    });

  const response: MemberRow = {
    userId: updated.userId,
    name: updated.user?.name ?? null,
    email: updated.user?.email ?? null,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    lastActiveAt: updated.lastActiveAt ? updated.lastActiveAt.toISOString() : null,
  };

  return apiSuccessResponse(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NOT_FOUND") return apiErrorResponse("Member not found", "NOT_FOUND", 404);
    if (msg === "LAST_OWNER_ROLE") return apiErrorResponse("Cannot change role of the last owner", "FORBIDDEN", 403);
    if (msg === "LAST_OWNER_SUSPEND") return apiErrorResponse("Cannot suspend the last owner", "FORBIDDEN", 403);
    if (msg === "SELF_LAST_OWNER_SUSPEND") return apiErrorResponse("Cannot suspend yourself as the last owner", "FORBIDDEN", 403);
    if (msg === "SELF_LAST_OWNER_ROLE") return apiErrorResponse("Cannot change your role as the last owner", "FORBIDDEN", 403);
    return apiErrorResponse("Update failed", "INTERNAL_ERROR", 500);
  }
}

/**
 * DELETE /api/teams-users/members
 * Owner/Admin only. Remove a membership.
 */
export async function DELETE(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const url = new URL(request.url);
  const targetUserIdFromQuery = url.searchParams.get("userId")?.trim() || null;

  warnIfBusinessIdParamPresent(request);

  let ctx;
  try {
    ctx = await requireTenant();
    await requirePermission("TEAMS_USERS", "MANAGE_TEAM");
  } catch (err) {
    if (err instanceof BusinessContextError) {
      return err.toHttpResponse();
    }
    return unauthorized();
  }

  let targetUserId = targetUserIdFromQuery;
  if (!targetUserId) {
    const json = await request.json().catch(() => null);
    const parsed = z.object({ userId: z.string().min(1) }).safeParse(json);
    if (!parsed.success) {
      return apiErrorResponse("Member userId is required", "VALIDATION_ERROR", 400);
    }
    targetUserId = parsed.data.userId;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.businessUser.findUnique({
        where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
      });

      if (!membership) throw new Error("NOT_FOUND");

      const activeOwners = await tx.businessUser.count({
        where: { businessId: ctx.businessId, role: "OWNER", status: "ACTIVE" },
      });
      const isLastActiveOwner = activeOwners <= 1;
      const targetIsActiveOwner = membership.role === "OWNER" && membership.status === "ACTIVE";
      const targetIsSelf = targetUserId === ctx.userId;

      // Cannot remove last ACTIVE owner
      if (targetIsActiveOwner && isLastActiveOwner) throw new Error("LAST_OWNER_REMOVE");

      // Cannot remove yourself if you're the last ACTIVE owner
      if (targetIsSelf && isLastActiveOwner && ctx.role === "OWNER") throw new Error("SELF_LAST_OWNER_REMOVE");

      await tx.businessUser.delete({
        where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
      });

      await tx.teamAuditLog.create({
        data: {
          businessId: ctx.businessId,
          actorUserId: ctx.userId,
          action: "MEMBER_REMOVED",
          targetUserId,
          metaJson: { role: membership.role, status: membership.status },
        },
      });
    });

    return apiSuccessResponse({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NOT_FOUND") return apiErrorResponse("Member not found", "NOT_FOUND", 404);
    if (msg === "LAST_OWNER_REMOVE") return apiErrorResponse("Cannot remove the last owner", "FORBIDDEN", 403);
    if (msg === "SELF_LAST_OWNER_REMOVE") return apiErrorResponse("Cannot remove yourself as the last owner", "FORBIDDEN", 403);
    return apiErrorResponse("Remove failed", "INTERNAL_ERROR", 500);
  }
}

