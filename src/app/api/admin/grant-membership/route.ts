/**
 * Dev-only admin route to grant a membership.
 *
 * Guard:
 * - Requires header `x-admin-secret` to match `process.env.ADMIN_GRANT_SECRET`
 * - Returns 404 in production as an additional safety net
 *
 * POST JSON: { email, businessId, role }
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiErrorResponse,
  apiSuccessResponse,
  handleApiError,
} from "@/lib/api/errorHandler";
import { TeamRole } from "@prisma/client";

function parseRoleOrDefault(raw: unknown): TeamRole {
  if (raw === undefined || raw === null || raw === "") return TeamRole.OWNER;
  const role = String(raw).trim().toUpperCase();
  if (role === "OWNER") return TeamRole.OWNER;
  if (role === "ADMIN") return TeamRole.ADMIN;
  if (role === "STAFF") return TeamRole.STAFF;
  throw new Error("Invalid role. Expected OWNER|ADMIN|STAFF");
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return apiErrorResponse("Not found", "NOT_FOUND", 404);
    }

    const expected = process.env.ADMIN_GRANT_SECRET;
    const provided = request.headers.get("x-admin-secret");
    if (!expected || !provided || provided !== expected) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const body = (await request.json().catch(() => null)) as
      | { email?: unknown; businessId?: unknown; role?: unknown }
      | null;

    const email = body?.email ? String(body.email).trim() : "";
    const businessId = body?.businessId ? String(body.businessId).trim() : "";
    const role = parseRoleOrDefault(body?.role);

    if (!email) {
      return apiErrorResponse("Missing email", "VALIDATION_ERROR", 400);
    }
    if (!businessId) {
      return apiErrorResponse("Missing businessId", "VALIDATION_ERROR", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return apiErrorResponse("User not found", "NOT_FOUND", 404);
    }

    const membership = await prisma.businessUser.upsert({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
      create: {
        businessId,
        userId: user.id,
        role,
        status: "ACTIVE",
      },
      update: {
        role,
        status: "ACTIVE",
      },
      select: {
        id: true,
        businessId: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccessResponse({
      user: { id: user.id, email: user.email },
      membership,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const runtime = "nodejs";

