import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { BusinessContextError, requireBusinessContext } from "@/lib/auth/requireBusinessContext";
import { getBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";

export const runtime = "nodejs";

function isOwnerOrAdmin(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

const InviteCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "STAFF"]).optional().default("STAFF"),
});

/**
 * GET /api/teams-users/invites
 * List pending invites for the resolved business.
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

  const now = new Date();
  const invites = await prisma.teamInvite.findMany({
    where: {
      businessId: ctx.businessId,
      acceptedAt: null,
      canceledAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = invites.map((i) => ({
    id: i.id,
    businessId: i.businessId,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
    createdByUserId: i.createdByUserId,
  }));

  return apiSuccessResponse(result);
}

/**
 * POST /api/teams-users/invites
 * Owner/Admin only. Create an invite.
 *
 * Returns inviteLink for MVP (copy link UI). No email automation.
 */
export async function POST(request: NextRequest) {
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
  const parsed = InviteCreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const email = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Prevent inviting an email already active in membership
  const alreadyMember = await prisma.businessUser.findFirst({
    where: {
      businessId: ctx.businessId,
      status: "ACTIVE",
      user: { email },
    },
    select: { userId: true },
  });

  if (alreadyMember) {
    return apiErrorResponse("User is already a member of this business", "VALIDATION_ERROR", 409);
  }

  // Enforce one active invite per email per business (in code)
  const existingPending = await prisma.teamInvite.findFirst({
    where: {
      businessId: ctx.businessId,
      email,
      acceptedAt: null,
      canceledAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true, expiresAt: true },
  });

  if (existingPending) {
    return apiErrorResponse("An active invite already exists for this email", "VALIDATION_ERROR", 409, {
      inviteId: existingPending.id,
      expiresAt: existingPending.expiresAt.toISOString(),
    });
  }

  // Create token + hash (store only hash)
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.teamInvite.create({
    data: {
      businessId: ctx.businessId,
      email,
      role,
      tokenHash,
      expiresAt,
      createdByUserId: ctx.userId,
    },
  });

  // MVP: return inviteLink for copy-link UI (page can POST token to accept endpoint)
  const baseUrl = getBaseUrl(request.nextUrl.origin).replace(/\/+$/, "");
  const inviteLink = `${baseUrl}/apps/teams-users/accept?token=${token}`;

  return apiSuccessResponse({
    id: invite.id,
    businessId: invite.businessId,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    inviteLink,
  }, 201);
}

/**
 * DELETE /api/teams-users/invites?id=...
 * Owner/Admin only. Cancel an invite by id.
 */
export async function DELETE(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const url = new URL(request.url);
  const requestedBusinessId = url.searchParams.get("businessId")?.trim() || null;
  const inviteId = url.searchParams.get("id")?.trim() || null;

  if (!inviteId) {
    return apiErrorResponse("Invite id is required", "VALIDATION_ERROR", 400);
  }

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

  const invite = await prisma.teamInvite.findFirst({
    where: { id: inviteId, businessId: ctx.businessId },
  });

  if (!invite) {
    return apiErrorResponse("Invite not found", "NOT_FOUND", 404);
  }

  if (invite.canceledAt) {
    return apiSuccessResponse({ canceled: true, id: invite.id });
  }

  const updated = await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { canceledAt: new Date() },
  });

  return apiSuccessResponse({ canceled: true, id: updated.id });
}

