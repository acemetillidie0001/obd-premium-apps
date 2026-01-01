/**
 * OBD Scheduler & Booking - CRM Integration (V3)
 * 
 * Auto-captures booking requests as CRM contacts and activities.
 * This module is tenant-safe and fails gracefully if CRM is not available.
 */

import { prisma } from "@/lib/prisma";
import {
  upsertContactFromExternalSource,
  addActivityNote,
} from "@/lib/apps/obd-crm/crmService";
import type { BookingRequest, BookingService } from "../types";

export interface SyncBookingToCrmOptions {
  businessId: string;
  request: BookingRequest;
  service?: BookingService | null;
}

/**
 * Sync a booking request to CRM.
 * 
 * This function:
 * 1. Upserts a CRM contact (matches by email, fallback to phone)
 * 2. Creates a "Booking Request" activity note
 * 
 * If CRM is not available or any error occurs, this function:
 * - Logs a minimal server-side warning
 * - Does NOT throw (non-blocking)
 * - Does NOT fail the booking request
 * 
 * @param options - Sync options
 * @returns true if sync succeeded, false otherwise
 */
export async function syncBookingToCrm({
  businessId,
  request,
  service,
}: SyncBookingToCrmOptions): Promise<boolean> {
  // Validate required fields
  if (!businessId || !request) {
    console.warn("[OBD Scheduler CRM] Missing required fields for CRM sync");
    return false;
  }

  // Require at least email or phone for CRM contact
  if (!request.customerEmail && !request.customerPhone) {
    console.warn("[OBD Scheduler CRM] No email or phone provided, skipping CRM sync");
    return false;
  }

  try {
    // Check if CRM tables exist (fail gracefully if not)
    if (!prisma?.crmContact || !prisma?.crmContactActivity) {
      console.warn("[OBD Scheduler CRM] CRM tables not available, skipping sync");
      return false;
    }

    // Upsert contact
    const contact = await upsertContactFromExternalSource({
      businessId,
      source: "scheduler",
      name: request.customerName,
      email: request.customerEmail || null,
      phone: request.customerPhone || null,
      tagNames: ["Booking Request"], // Optional tag
    });

    // Build activity note content
    const noteParts: string[] = [];
    noteParts.push("Created from booking request.");

    if (service) {
      noteParts.push(`Service: ${service.name}`);
    }

    if (request.preferredStart && request.preferredEnd) {
      const start = new Date(request.preferredStart).toLocaleString();
      const end = new Date(request.preferredEnd).toLocaleString();
      noteParts.push(`Preferred window: ${start} - ${end}`);
    } else if (request.preferredStart) {
      const start = new Date(request.preferredStart).toLocaleString();
      noteParts.push(`Preferred start: ${start}`);
    }

    if (request.message) {
      noteParts.push(`Message: ${request.message}`);
    }

    noteParts.push(`Status: ${request.status}`);

    const noteContent = noteParts.join("\n");

    // Create activity note
    await addActivityNote({
      businessId,
      contactId: contact.id,
      note: noteContent,
    });

    // Log success (dev only)
    if (process.env.NODE_ENV !== "production") {
      console.log("[OBD Scheduler CRM] Successfully synced booking request to CRM:", {
        contactId: contact.id,
        requestId: request.id,
      });
    }

    return true;
  } catch (error) {
    // Log error but don't throw (non-blocking)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("[OBD Scheduler CRM] Failed to sync booking request to CRM:", errorMessage);
    return false;
  }
}

