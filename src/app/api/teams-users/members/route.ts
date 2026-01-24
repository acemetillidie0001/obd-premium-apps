import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { BusinessContextError, requireBusinessContext } from "@/lib/auth/requireBusinessContext";

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

function isOwnerOrAdmin(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

const PatchSchema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["ADMIN", "STAFF"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: "At least one of role or status must be provided",
  });

async function getActiveOwnerCount(businessId: string): Promise<number> {
  return prisma.businessUser.count({
    where: { businessId, role: "OWNER", status: "ACTIVE" },
  });
}

/**
 * GET /api/teams-users/members
 * List members for the resolved business.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedBusinessId = searchParams.get("businessId")?.trim() || null;

  let ctx;
  try {
    ctx = await requireBusinessContext({ requestedBusinessId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }

  const members = await prisma.businessUser.findMany({
    where: { businessId: ctx.businessId },
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
}

/**
 * PATCH /api/teams-users/members
 * Owner/Admin only. Update member role (ADMIN/STAFF) and/or status (ACTIVE/SUSPENDED).
 */
export async function PATCH(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const { searchParams } = new URL(request.url);
  const requestedBusinessId = searchParams.get("businessId")?.trim() || null;

  let ctx;
  try {
    ctx = await requireBusinessContext({ requestedBusinessId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }

  if (!isOwnerOrAdmin(ctx.role)) {
    return apiErrorResponse("Forbidden", "FORBIDDEN", 403);
  }

  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { userId: targetUserId, role: nextRole, status: nextStatus } = parsed.data;

  const membership = await prisma.businessUser.findUnique({
    where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
  });

  if (!membership) {
    return apiErrorResponse("Member not found", "NOT_FOUND", 404);
  }

  const activeOwners = await getActiveOwnerCount(ctx.businessId);
  const isLastActiveOwner = activeOwners <= 1;
  const targetIsActiveOwner = membership.role === "OWNER" && membership.status === "ACTIVE";
  const targetIsSelf = targetUserId === ctx.userId;

  // Cannot demote the last ACTIVE owner
  if (nextRole && targetIsActiveOwner && isLastActiveOwner) {
    return apiErrorResponse("Cannot change role of the last owner", "FORBIDDEN", 403);
  }

  // Cannot suspend the last ACTIVE owner
  if (nextStatus === "SUSPENDED" && targetIsActiveOwner && isLastActiveOwner) {
    return apiErrorResponse("Cannot suspend the last owner", "FORBIDDEN", 403);
  }

  // Cannot suspend/demote yourself if you're the last ACTIVE owner
  if (targetIsSelf && isLastActiveOwner && ctx.role === "OWNER") {
    if (nextStatus === "SUSPENDED") {
      return apiErrorResponse("Cannot suspend yourself as the last owner", "FORBIDDEN", 403);
    }
    if (nextRole) {
      return apiErrorResponse("Cannot change your role as the last owner", "FORBIDDEN", 403);
    }
  }

  const updated = await prisma.businessUser.update({
    where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
    data: {
      ...(nextRole ? { role: nextRole } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
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
  const requestedBusinessId = url.searchParams.get("businessId")?.trim() || null;
  const targetUserIdFromQuery = url.searchParams.get("userId")?.trim() || null;

  let ctx;
  try {
    ctx = await requireBusinessContext({ requestedBusinessId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }

  if (!isOwnerOrAdmin(ctx.role)) {
    return apiErrorResponse("Forbidden", "FORBIDDEN", 403);
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

  const membership = await prisma.businessUser.findUnique({
    where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
  });

  if (!membership) {
    return apiErrorResponse("Member not found", "NOT_FOUND", 404);
  }

  const activeOwners = await getActiveOwnerCount(ctx.businessId);
  const isLastActiveOwner = activeOwners <= 1;
  const targetIsActiveOwner = membership.role === "OWNER" && membership.status === "ACTIVE";
  const targetIsSelf = targetUserId === ctx.userId;

  // Cannot remove last ACTIVE owner
  if (targetIsActiveOwner && isLastActiveOwner) {
    return apiErrorResponse("Cannot remove the last owner", "FORBIDDEN", 403);
  }

  // Cannot remove yourself if you're the last ACTIVE owner
  if (targetIsSelf && isLastActiveOwner && ctx.role === "OWNER") {
    return apiErrorResponse("Cannot remove yourself as the last owner", "FORBIDDEN", 403);
  }

  await prisma.businessUser.delete({
    where: { businessId_userId: { businessId: ctx.businessId, userId: targetUserId } },
  });

  return apiSuccessResponse({ deleted: true });
}

