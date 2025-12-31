/**
 * OBD CRM Service Module (V3)
 * 
 * Provides reusable functions for other apps to integrate with CRM contacts.
 * All functions are business-scoped and do NOT include premium/rate-limit checks
 * (callers should handle those at the API route level).
 */

import { prisma } from "@/lib/prisma";
import type {
  CrmContact,
  CrmContactSource,
  CrmContactStatus,
} from "./types";

/**
 * Normalize email (lowercase, trim)
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  return email.trim().toLowerCase() || null;
}

/**
 * Normalize phone to digits only (for comparison/matching).
 * Strips all non-digit characters.
 * Returns null if empty after normalization.
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/**
 * Format contact from DB result (same format as API routes)
 */
function formatContact(contact: any): CrmContact {
  return {
    id: contact.id,
    businessId: contact.businessId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    address: contact.address,
    status: contact.status as CrmContactStatus,
    source: contact.source as CrmContactSource,
    tags: (contact.tags || []).map((ct: any) => ({
      id: ct.tag.id,
      businessId: ct.tag.businessId,
      name: ct.tag.name,
      color: ct.tag.color,
      createdAt: ct.tag.createdAt.toISOString(),
      updatedAt: ct.tag.updatedAt.toISOString(),
    })),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

/**
 * Find a contact by email or phone (or both) within a business scope.
 * Returns the first matching contact, or null if none found.
 * 
 * Matching logic:
 * - Email: case-insensitive match
 * - Phone: normalized digits match (compares stored phone after normalizing both)
 * 
 * @param options.businessId - Required business ID (must match user's business)
 * @param options.email - Optional email to search for (case-insensitive)
 * @param options.phone - Optional phone to search for (normalized digits match)
 * @returns The matching contact or null
 */
export async function findContactByEmailOrPhone({
  businessId,
  email,
  phone,
}: {
  businessId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<CrmContact | null> {
  if (!businessId) {
    throw new Error("businessId is required");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhoneDigits = normalizePhone(phone);

  // At least one identifier must be provided
  if (!normalizedEmail && !normalizedPhoneDigits) {
    return null;
  }

  let contact = null;

  // Try email match first (prioritized, more reliable, indexed)
  if (normalizedEmail) {
    contact = await prisma.crmContact.findFirst({
      where: {
        businessId,
        email: normalizedEmail,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  // If no email match and phone provided, search by phone (normalized comparison)
  if (!contact && normalizedPhoneDigits) {
    // Fetch all contacts with phone numbers for this business
    const contactsWithPhone = await prisma.crmContact.findMany({
      where: {
        businessId,
        phone: { not: null },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Find first contact where normalized phone digits match
    for (const candidate of contactsWithPhone) {
      if (candidate.phone) {
        const candidateDigits = normalizePhone(candidate.phone);
        if (candidateDigits === normalizedPhoneDigits) {
          contact = candidate;
          break;
        }
      }
    }
  }

  return contact ? formatContact(contact) : null;
}

/**
 * Create a new contact.
 * 
 * @param options.businessId - Required business ID
 * @param options.name - Required contact name (min 2 chars)
 * @param options.email - Optional email
 * @param options.phone - Optional phone
 * @param options.source - Required source (e.g., "scheduler", "reviews", "helpdesk")
 * @param options.tags - Optional array of tag IDs (must belong to business)
 * @returns The created contact
 */
export async function createContact({
  businessId,
  name,
  email,
  phone,
  source,
  tags,
  company,
  address,
  status,
}: {
  businessId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source: CrmContactSource;
  tags?: string[];
  company?: string | null;
  address?: string | null;
  status?: CrmContactStatus;
}): Promise<CrmContact> {
  if (!businessId) {
    throw new Error("businessId is required");
  }

  if (!name || name.trim().length < 2) {
    throw new Error("name must be at least 2 characters");
  }

  if (!source) {
    throw new Error("source is required");
  }

  const normalizedEmail = normalizeEmail(email);

  // Validate tags belong to this business if provided
  if (tags && tags.length > 0) {
    const tagCount = await prisma.crmTag.count({
      where: {
        id: { in: tags },
        businessId,
      },
    });
    if (tagCount !== tags.length) {
      throw new Error("One or more tags not found or do not belong to the business");
    }
  }

  const contact = await prisma.crmContact.create({
    data: {
      businessId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null, // Store original format (trimmed)
      company: company?.trim() || null,
      address: address?.trim() || null,
      status: status || "Lead",
      source,
      tags: tags && tags.length > 0
        ? {
            create: tags.map((tagId) => ({
              tagId,
            })),
          }
        : undefined,
    },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  return formatContact(contact);
}

/**
 * Upsert a contact from an external source (e.g., scheduler, reviews, helpdesk).
 * Finds existing contact by email or phone, or creates a new one.
 * Optionally creates/assigns tags by name.
 * 
 * @param options.businessId - Required business ID
 * @param options.source - Required source (e.g., "scheduler", "reviews", "helpdesk")
 * @param options.name - Required contact name
 * @param options.email - Optional email (used for matching)
 * @param options.phone - Optional phone (used for matching)
 * @param options.tagNames - Optional array of tag names (will be created if they don't exist)
 * @returns The contact (found or created)
 */
export async function upsertContactFromExternalSource({
  businessId,
  source,
  name,
  email,
  phone,
  tagNames,
  company,
  address,
}: {
  businessId: string;
  source: CrmContactSource;
  name: string;
  email?: string | null;
  phone?: string | null;
  tagNames?: string[];
  company?: string | null;
  address?: string | null;
}): Promise<CrmContact> {
  if (!businessId) {
    throw new Error("businessId is required");
  }

  if (!name || name.trim().length < 2) {
    throw new Error("name must be at least 2 characters");
  }

  if (!source) {
    throw new Error("source is required");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhoneDigits = normalizePhone(phone);

  // Require at least one identifier (email or phone) for upsert
  if (!normalizedEmail && !normalizedPhoneDigits) {
    throw new Error("At least one of email or phone must be provided for upsert");
  }

  // Try to find existing contact
  // Pass original phone if it normalizes to non-empty digits, otherwise null
  const existing = await findContactByEmailOrPhone({
    businessId,
    email: normalizedEmail,
    phone: normalizedPhoneDigits ? phone : null, // Pass original phone (function will normalize)
  });

  // Dev-only logging for integration debugging
  if (process.env.NODE_ENV !== "production") {
    let matchedBy: string | null = null;
    if (existing) {
      // Infer match method: email is tried first, so if email provided and matches, it was email
      // Otherwise, if phone provided, it was phone
      if (normalizedEmail && existing.email?.toLowerCase() === normalizedEmail) {
        matchedBy = "email";
      } else if (normalizedPhoneDigits) {
        matchedBy = "phone";
      }
    }
    console.log("[CRM Integration] upsertContactFromExternalSource:", {
      source,
      action: existing ? "found" : "created",
      matchedBy: matchedBy || (existing ? "unknown" : null),
      hasEmail: !!normalizedEmail,
      hasPhone: !!normalizedPhoneDigits,
      contactId: existing?.id || "new",
    });
  }

  // Resolve tag IDs (create tags if they don't exist)
  // Normalize tag names: trim, collapse whitespace, enforce case-insensitive uniqueness
  let tagIds: string[] = [];
  if (tagNames && tagNames.length > 0) {
    // Normalize tag names: trim, collapse whitespace to single space
    const normalizedTagNames = tagNames
      .map((n) => n.trim().replace(/\s+/g, " "))
      .filter((n) => n.length > 0);

    // Enforce case-insensitive uniqueness using a Map
    const uniqueTagNamesMap = new Map<string, string>();
    for (const normalizedName of normalizedTagNames) {
      const lowerKey = normalizedName.toLowerCase();
      if (!uniqueTagNamesMap.has(lowerKey)) {
        uniqueTagNamesMap.set(lowerKey, normalizedName);
      }
    }

    // Process tags in deterministic order (sorted by normalized name)
    const sortedUniqueNames = Array.from(uniqueTagNamesMap.values()).sort();

    for (const tagName of sortedUniqueNames) {
      // Find existing tag by case-insensitive name match
      // Since schema has unique constraint on businessId+name, we need to check case-insensitively
      const existingTags = await prisma.crmTag.findMany({
        where: {
          businessId,
        },
      });

      let tag = existingTags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase()
      );

      if (!tag) {
        // Create new tag with normalized name
        tag = await prisma.crmTag.create({
          data: {
            businessId,
            name: tagName,
          },
        });
      }

      tagIds.push(tag.id);
    }

    // Ensure tagIds are unique and sorted for deterministic order
    tagIds = [...new Set(tagIds)].sort();
  }

  if (existing) {
    // Update existing contact
    // Merge data: update name if provided and longer, merge other fields if missing
    const updateData: any = {};

    if (name.trim().length >= existing.name.length) {
      updateData.name = name.trim();
    }

    if (normalizedEmail && !existing.email) {
      updateData.email = normalizedEmail;
    }

    // For phone, store the original format but only update if missing
    // Note: We compare using normalized digits, but store original format
    if (phone && !existing.phone) {
      updateData.phone = phone.trim() || null;
    }

    if (company?.trim() && !existing.company) {
      updateData.company = company.trim();
    }

    if (address?.trim() && !existing.address) {
      updateData.address = address.trim();
    }

    // Update source if it's more specific (keep existing if already set)
    // In V3, we don't overwrite source, but could in future versions

    // Update tags if needed
    if (tagIds.length > 0) {
      // Get current tag IDs from the contact
      const currentTagRelations = await prisma.crmContactTag.findMany({
        where: { contactId: existing.id },
      });
      const currentTagIds = currentTagRelations.map((ct: { tagId: string }) => ct.tagId);
      const allTagIds = [...new Set([...currentTagIds, ...tagIds])];

      // Remove old tags
      await prisma.crmContactTag.deleteMany({
        where: {
          contactId: existing.id,
        },
      });

      // Add all tags (existing + new)
      // Ensure deterministic order and no duplicates
      const uniqueTagIds = [...new Set(allTagIds)].sort();
      if (uniqueTagIds.length > 0) {
        await prisma.crmContactTag.createMany({
          data: uniqueTagIds.map((tagId) => ({
            contactId: existing.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Update contact if there are changes
    if (Object.keys(updateData).length > 0 || tagIds.length > 0) {
      const updated = await prisma.crmContact.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      return formatContact(updated);
    }

    return existing;
  } else {
    // Create new contact
    // Store phone in original format (trimmed), but matching uses normalized digits
    return createContact({
      businessId,
      name,
      email: normalizedEmail,
      phone: phone?.trim() || null, // Store original format
      source,
      tags: tagIds,
      company: company?.trim() || null,
      address: address?.trim() || null,
      status: "Lead",
    });
  }
}

/**
 * Add an activity note to a contact.
 * 
 * @param options.businessId - Required business ID (for verification)
 * @param options.contactId - Required contact ID
 * @param options.note - Required note content
 * @param options.createdByUserId - Optional user ID for tracking (not stored in V3, but included for future use)
 * @returns The created activity
 */
export async function addActivityNote({
  businessId,
  contactId,
  note,
  createdByUserId,
}: {
  businessId: string;
  contactId: string;
  note: string;
  createdByUserId?: string;
}): Promise<{
  id: string;
  contactId: string;
  businessId: string;
  type: "note";
  content: string;
  createdAt: string;
  updatedAt: string;
}> {
  if (!businessId) {
    throw new Error("businessId is required");
  }

  if (!contactId) {
    throw new Error("contactId is required");
  }

  if (!note || note.trim().length === 0) {
    throw new Error("note content is required");
  }

  // Verify contact exists and belongs to this business
  const contact = await prisma.crmContact.findFirst({
    where: {
      id: contactId,
      businessId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found or does not belong to the business");
  }

  // Create activity (V3 supports "note" type only)
  const activity = await prisma.crmContactActivity.create({
    data: {
      contactId,
      businessId,
      type: "note",
      content: note.trim(),
    },
  });

  return {
    id: activity.id,
    contactId: activity.contactId,
    businessId: activity.businessId,
    type: "note" as const,
    content: activity.content ?? "",
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

