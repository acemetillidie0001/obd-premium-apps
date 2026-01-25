import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";

export const runtime = "nodejs";

const AcceptSchema = z.object({
  token: z.string().min(20),
});

/**
 * POST /api/teams-users/invites/accept
 * Body: { token }
 *
 * Must be authenticated.
 * Enforces:
 * - invite exists, not expired, not canceled, not accepted
 * - session.user.email matches invite.email
 * - creates BusinessUser membership for invite.businessId
 * - marks invite acceptedAt
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const json = await request.json().catch(() => null);
  const parsed = AcceptSchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorResponse("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const session = await auth();
  const userId = session?.user?.id || null;
  const email = session?.user?.email?.trim().toLowerCase() || null;

  if (!userId) {
    return apiErrorResponse("Authentication required", "UNAUTHORIZED", 401);
  }

  if (!email) {
    return apiErrorResponse("Authenticated user email is required to accept an invite", "VALIDATION_ERROR", 400);
  }

  const token = parsed.data.token.trim();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.teamInvite.findFirst({
    where: { tokenHash },
  });

  if (!invite) {
    return apiErrorResponse("Invite not found", "NOT_FOUND", 404);
  }

  const now = new Date();
  if (invite.canceledAt) {
    return apiErrorResponse("Invite was canceled", "FORBIDDEN", 403);
  }
  if (invite.expiresAt <= now) {
    return apiErrorResponse("Invite has expired", "FORBIDDEN", 403);
  }

  // Enforce email match
  const inviteEmailNormalized = invite.email.trim().toLowerCase();
  if (inviteEmailNormalized !== email) {
    return apiErrorResponse("Invite email does not match your account", "FORBIDDEN", 403);
  }

  // Idempotent: if already accepted, return success.
  if (invite.acceptedAt) {
    return apiSuccessResponse({
      accepted: true,
      businessId: invite.businessId,
      role: invite.role,
    });
  }

  // Create membership + mark accepted (transaction)
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.businessUser.findUnique({
        where: {
          businessId_userId: { businessId: invite.businessId, userId },
        },
        select: { id: true, role: true },
      });

      // Idempotent: if membership already exists, just mark invite accepted (if needed) and return success.
      if (existing) {
        const inviteRow = await tx.teamInvite.findUnique({
          where: { id: invite.id },
          select: { acceptedAt: true },
        });

        if (!inviteRow) throw new Error("NOT_FOUND");

        if (!inviteRow.acceptedAt) {
          await tx.teamInvite.update({
            where: { id: invite.id },
            data: { acceptedAt: now },
          });

          await tx.teamAuditLog.create({
            data: {
              businessId: invite.businessId,
              actorUserId: userId,
              action: "INVITE_ACCEPTED",
              targetUserId: userId,
              targetEmail: email,
              metaJson: { inviteId: invite.id, role: invite.role, idempotent: true },
            },
          });
        }

        return { businessId: invite.businessId, role: existing.role };
      }

      const membership = await tx.businessUser.create({
        data: {
          businessId: invite.businessId,
          userId,
          role: invite.role,
          status: "ACTIVE",
        },
      });

      const updatedInvite = await tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: now },
      });

      await tx.teamAuditLog.create({
        data: {
          businessId: invite.businessId,
          actorUserId: userId,
          action: "INVITE_ACCEPTED",
          targetUserId: userId,
          targetEmail: email,
          metaJson: { inviteId: invite.id, role: invite.role },
        },
      });

      void updatedInvite;
      return { businessId: membership.businessId, role: membership.role };
    });

    return apiSuccessResponse({
      accepted: true,
      businessId: result.businessId,
      role: result.role,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NOT_FOUND") return apiErrorResponse("Invite not found", "NOT_FOUND", 404);
    return apiErrorResponse("Failed to accept invite", "INTERNAL_ERROR", 500);
  }
}

