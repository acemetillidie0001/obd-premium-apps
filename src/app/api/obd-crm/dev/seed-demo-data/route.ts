/**
 * OBD CRM Dev-Only Demo Data Seeder
 * 
 * Creates 3 demo contacts with tags and notes for the current business.
 * 
 * ⚠️ DEV ONLY - Disabled in production for security.
 * 
 * Usage (development only):
 * POST /api/obd-crm/dev/seed-demo-data
 * 
 * This endpoint:
 * - Creates 3 sample contacts with different statuses
 * - Creates 2-3 tags
 * - Assigns tags to contacts
 * - Adds sample notes to contacts
 * - All data is scoped to the authenticated user's business
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/obd-crm/dev/seed-demo-data
 * Create demo contacts, tags, and notes for development
 */
export async function POST(request: NextRequest) {
  // DEV ONLY: Block in production
  if (process.env.NODE_ENV === "production") {
    return apiErrorResponse(
      "This endpoint is disabled in production",
      "UNAUTHORIZED",
      404
    );
  }

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check if demo data already exists (optional safety check)
    const existingCount = await prisma.crmContact.count({
      where: { businessId },
    });

    if (existingCount > 0) {
      // Allow seeding even if contacts exist (dev helper, not critical)
      // Could add a query param to force clear first if needed
    }

    // Create tags
    const vipTag = await prisma.crmTag.upsert({
      where: {
        businessId_name: {
          businessId,
          name: "VIP",
        },
      },
      update: {},
      create: {
        businessId,
        name: "VIP",
        color: "#29c4a9",
      },
    });

    const followUpTag = await prisma.crmTag.upsert({
      where: {
        businessId_name: {
          businessId,
          name: "Follow-up",
        },
      },
      update: {},
      create: {
        businessId,
        name: "Follow-up",
        color: "#f59e0b",
      },
    });

    const prospectTag = await prisma.crmTag.upsert({
      where: {
        businessId_name: {
          businessId,
          name: "Prospect",
        },
      },
      update: {},
      create: {
        businessId,
        name: "Prospect",
        color: "#3b82f6",
      },
    });

    // Create contacts
    const contact1 = await prisma.crmContact.create({
      data: {
        businessId,
        name: "Sarah Johnson",
        email: "sarah.johnson@example.com",
        phone: "352-555-0101",
        company: "Johnson & Associates",
        address: "123 Main Street, Ocala, FL 34471",
        status: "Active",
        source: "manual",
        tags: {
          create: [
            { tagId: vipTag.id },
            { tagId: followUpTag.id },
          ],
        },
      },
    });

    const contact2 = await prisma.crmContact.create({
      data: {
        businessId,
        name: "Michael Chen",
        email: "mchen@techcorp.com",
        phone: "352-555-0102",
        company: "TechCorp Solutions",
        address: "456 Oak Avenue, Ocala, FL 34475",
        status: "Lead",
        source: "manual",
        tags: {
          create: [
            { tagId: prospectTag.id },
          ],
        },
      },
    });

    const contact3 = await prisma.crmContact.create({
      data: {
        businessId,
        name: "Emily Rodriguez",
        email: "emily.rodriguez@example.com",
        phone: "352-555-0103",
        company: "Rodriguez Design Studio",
        address: "789 Pine Road, Ocala, FL 34470",
        status: "Past",
        source: "manual",
        tags: {
          create: [
            { tagId: followUpTag.id },
          ],
        },
      },
    });

    // Add notes/activities
    await prisma.crmContactActivity.createMany({
      data: [
        {
          contactId: contact1.id,
          businessId,
          type: "note",
          content: "Had initial consultation call. Very interested in our premium services. Follow up next week.",
        },
        {
          contactId: contact1.id,
          businessId,
          type: "note",
          content: "Sent proposal and pricing sheet. Waiting for response.",
        },
        {
          contactId: contact2.id,
          businessId,
          type: "note",
          content: "Met at networking event. Discussed potential partnership opportunities.",
        },
        {
          contactId: contact3.id,
          businessId,
          type: "note",
          content: "Completed project successfully. Client was very satisfied with results.",
        },
      ],
    });

    return apiSuccessResponse({
      message: "Demo data created successfully",
      created: {
        contacts: 3,
        tags: 3,
        notes: 4,
      },
      contacts: [
        { id: contact1.id, name: contact1.name },
        { id: contact2.id, name: contact2.name },
        { id: contact3.id, name: contact3.name },
      ],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

