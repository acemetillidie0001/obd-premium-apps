import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";

/**
 * DELETE /api/social-auto-poster/queue/delete
 * 
 * Deletes a queue item (tenant-safe by construction).
 */
export async function DELETE(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const { userId } = await requireTenant();
    await requirePermission("SOCIAL_AUTO_POSTER", "DELETE");

    const hasAccess = await hasPremiumAccess();
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Premium access required" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validation
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check that the item exists and belongs to the user (tenant-safe)
    const existingItem = await prisma.socialQueueItem.findFirst({
      where: {
        id: body.id,
        userId, // Tenant-safe: only delete items belonging to the current user
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    // Delete the item (defense-in-depth: include userId in where clause)
    const deleteResult = await prisma.socialQueueItem.deleteMany({
      where: {
        id: body.id,
        userId, // Defense-in-depth: ensure we only delete user's own items
      },
    });

    // If no rows were affected, return 404 (shouldn't happen after findFirst check, but defense-in-depth)
    if (deleteResult.count === 0) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error deleting queue item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete queue item" },
      { status: 500 }
    );
  }
}

