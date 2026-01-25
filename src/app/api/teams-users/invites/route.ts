import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { getBaseUrl } from "@/lib/apps/social-auto-poster/getBaseUrl";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";

export const runtime = "nodejs";

const InviteCreateSchema = z.object({
  email: z.string().email(),
  mode: z.enum(["create", "resend"]).optional().default("create"),
  role: z.enum(["ADMIN", "STAFF"]).optional().default("STAFF"),
});

/**
 * GET /api/teams-users/invites
 * List pending invites for the resolved business.
 */
export async function GET(request: NextRequest) {
  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId } = await requireTenant();

    const now = new Date();
    const invites = await prisma.teamInvite.findMany({
      where: {
        businessId,
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }
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

  let ctx;
  try {
    warnIfBusinessIdParamPresent(request);
    ctx = await requireTenant();
    await requirePermission("TEAMS_USERS", "MANAGE_TEAM");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }

  const json = await request.json().catch(() => null);
  const parsed = InviteCreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const email = parsed.data.email.trim().toLowerCase();
  const mode = parsed.data.mode;
  const role = parsed.data.role;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Normalize email and prevent inviting an existing member (any status).
  // Note: we treat membership existence as authoritative; invite creation/resend must not proceed.
  const alreadyMember = await prisma.businessUser.findFirst({
    where: {
      businessId: ctx.businessId,
      user: { email: { equals: email, mode: "insensitive" } },
    },
    select: { userId: true },
  });

  if (alreadyMember) {
    return apiErrorResponse("That email is already a team member.", "VALIDATION_ERROR", 409);
  }

  // Resend mode: rotate token + extend expiry for an existing invite
  if (mode === "resend") {
    // Generate token + hash (store only hash)
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    try {
      const updatedInvite = await prisma.$transaction(async (tx) => {
        const invite = await tx.teamInvite.findFirst({
          where: {
            businessId: ctx.businessId,
            email: { equals: email, mode: "insensitive" },
            acceptedAt: null,
          },
          orderBy: { createdAt: "desc" },
        });

        if (!invite) throw new Error("NOT_FOUND");
        if (invite.acceptedAt) throw new Error("ACCEPTED");

        if (invite.expiresAt <= now) {
          if (invite.canceledAt) throw new Error("CANCELED_EXPIRED");
          throw new Error("EXPIRED");
        }

        const updated = await tx.teamInvite.update({
          where: { id: invite.id },
          data: {
            tokenHash,
            expiresAt,
            ...(invite.canceledAt ? { canceledAt: null } : {}),
          },
        });

        await tx.teamAuditLog.create({
          data: {
            businessId: ctx.businessId,
            actorUserId: ctx.userId,
            action: "INVITE_RESENT",
            targetEmail: email,
            metaJson: {
              inviteId: invite.id,
              fromExpiresAt: invite.expiresAt.toISOString(),
              toExpiresAt: expiresAt.toISOString(),
              wasCanceled: !!invite.canceledAt,
            },
          },
        });

        return updated;
      });

      const baseUrl = getBaseUrl(request.nextUrl.origin).replace(/\/+$/, "");
      const inviteLink = `${baseUrl}/apps/teams-users/accept?token=${token}`;

      return apiSuccessResponse({
        id: updatedInvite.id,
        businessId: updatedInvite.businessId,
        email: updatedInvite.email,
        role: updatedInvite.role,
        expiresAt: updatedInvite.expiresAt.toISOString(),
        inviteLink,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "NOT_FOUND") return apiErrorResponse("Invite not found", "NOT_FOUND", 404);
      if (msg === "ACCEPTED") return apiErrorResponse("Invite was already accepted", "VALIDATION_ERROR", 409);
      if (msg === "CANCELED_EXPIRED") {
        return apiErrorResponse(
          "Invite was canceled and has expired. Create a new invite instead.",
          "VALIDATION_ERROR",
          409
        );
      }
      if (msg === "EXPIRED") {
        return apiErrorResponse("Invite has expired. Create a new invite instead.", "VALIDATION_ERROR", 409);
      }
      return apiErrorResponse("Failed to refresh invite link", "INTERNAL_ERROR", 500);
    }
  }

  // Enforce one active invite per email per business (in code).
  //
  // Behavior decision (idempotent + collision-safe):
  // - If an active invite already exists and mode === "create": return 409 and require "resend" explicitly.
  //   Rationale: we do not store raw tokens; therefore we cannot return an existing inviteLink for a prior invite.
  const existingPending = await prisma.teamInvite.findFirst({
    where: {
      businessId: ctx.businessId,
      email: { equals: email, mode: "insensitive" },
      acceptedAt: null,
      canceledAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true, expiresAt: true },
  });

  if (existingPending) {
    return apiErrorResponse("An active invite already exists for this email. Use refresh link to resend.", "VALIDATION_ERROR", 409, {
      inviteId: existingPending.id,
      expiresAt: existingPending.expiresAt.toISOString(),
    });
  }

  // Create token + hash (store only hash)
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.teamInvite.create({
      data: {
        businessId: ctx.businessId,
        email,
        role,
        tokenHash,
        expiresAt,
        createdByUserId: ctx.userId,
      },
    });

    await tx.teamAuditLog.create({
      data: {
        businessId: ctx.businessId,
        actorUserId: ctx.userId,
        action: "INVITE_CREATED",
        targetEmail: email,
        metaJson: {
          inviteId: created.id,
          role: created.role,
          expiresAt: created.expiresAt.toISOString(),
        },
      },
    });

    return created;
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
  const inviteId = url.searchParams.get("id")?.trim() || null;

  if (!inviteId) {
    return apiErrorResponse("Invite id is required", "VALIDATION_ERROR", 400);
  }

  let ctx;
  try {
    warnIfBusinessIdParamPresent(request);
    ctx = await requireTenant();
    await requirePermission("TEAMS_USERS", "MANAGE_TEAM");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.teamInvite.findFirst({
        where: { id: inviteId, businessId: ctx.businessId },
      });

      if (!invite) throw new Error("NOT_FOUND");

      if (invite.canceledAt) {
        return { canceled: true, id: invite.id, didCancelNow: false, email: invite.email };
      }

      const updated = await tx.teamInvite.update({
        where: { id: invite.id },
        data: { canceledAt: new Date() },
      });

      await tx.teamAuditLog.create({
        data: {
          businessId: ctx.businessId,
          actorUserId: ctx.userId,
          action: "INVITE_CANCELED",
          targetEmail: invite.email,
          metaJson: { inviteId: invite.id },
        },
      });

      return { canceled: true, id: updated.id, didCancelNow: true, email: invite.email };
    });

    return apiSuccessResponse({ canceled: result.canceled, id: result.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NOT_FOUND") return apiErrorResponse("Invite not found", "NOT_FOUND", 404);
    return apiErrorResponse("Failed to cancel invite", "INTERNAL_ERROR", 500);
  }
}

