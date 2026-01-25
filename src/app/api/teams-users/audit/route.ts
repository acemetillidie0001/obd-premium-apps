import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/api/errorHandler";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";

export const runtime = "nodejs";

type AuditLogDto = {
  createdAt: string;
  action: string;
  actorUserId: string;
  targetUserId: string | null;
  targetEmail: string | null;
  metaJson: unknown | null;
};

/**
 * GET /api/teams-users/audit
 * Owner/Admin only. Returns last 20 TeamAuditLog rows for this business.
 */
export async function GET(request: NextRequest) {
  warnIfBusinessIdParamPresent(request);

  let ctx;
  try {
    ctx = await requirePermission("TEAMS_USERS", "MANAGE_TEAM");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof BusinessContextError) {
      const code = err.status === 401 ? "UNAUTHORIZED" : err.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(msg, code, err.status);
    }
    return apiErrorResponse(msg, "UNAUTHORIZED", 401);
  }

  const rows = await prisma.teamAuditLog.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      createdAt: true,
      action: true,
      actorUserId: true,
      targetUserId: true,
      targetEmail: true,
      metaJson: true,
    },
  });

  const dto: AuditLogDto[] = rows.map((r) => ({
    createdAt: r.createdAt.toISOString(),
    action: r.action,
    actorUserId: r.actorUserId,
    targetUserId: r.targetUserId ?? null,
    targetEmail: r.targetEmail ?? null,
    metaJson: (r.metaJson as unknown) ?? null,
  }));

  return apiSuccessResponse(dto);
}

