/**
 * Shared Handoff Validators
 * 
 * Zod schemas for validating handoff payloads at runtime.
 * All validators enforce size limits and tenant-safety constraints.
 */

import { z } from "zod";
import type { WebDraftPayload } from "./types";

/**
 * Maximum serialized JSON size in bytes (150KB)
 */
const MAX_PAYLOAD_SIZE_BYTES = 150 * 1024;

/**
 * Zod schema for Web Draft Section (discriminated union)
 */
const webDraftSectionSchema = z.discriminatedUnion("type", [
  // Heading section: requires level 2-4 and text
  z.object({
    type: z.literal("heading"),
    level: z.number().int().min(2).max(4),
    text: z.string().min(1, "Heading text is required"),
  }),
  // Paragraph section: requires text
  z.object({
    type: z.literal("paragraph"),
    text: z.string().min(1, "Paragraph text is required"),
  }),
  // List section: requires items array (max 50)
  z.object({
    type: z.literal("list"),
    items: z
      .array(z.string())
      .min(1, "List must have at least one item")
      .max(50, "List cannot exceed 50 items"),
  }),
]);

/**
 * Zod schema for Web Draft Content
 */
const webDraftContentSchema = z.object({
  title: z.string().min(1, "Title is required and cannot be empty"),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  sections: z
    .array(webDraftSectionSchema)
    .min(1, "At least one section is required")
    .max(200, "Maximum 200 sections allowed"),
  callToAction: z.string().optional(),
});

/**
 * Zod schema for Web Draft Meta
 */
const webDraftMetaSchema = z.object({
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
});

/**
 * Zod schema for Web Draft Payload
 */
export const webDraftPayloadSchema = z.object({
  mode: z.literal("web-draft"),
  source: z.literal("ai-content-writer"),
  version: z.literal("1.0"),
  content: webDraftContentSchema,
  meta: webDraftMetaSchema.optional(),
}).refine(
  (data) => {
    // Enforce max 150KB serialized JSON size
    const jsonString = JSON.stringify(data);
    const sizeBytes = new TextEncoder().encode(jsonString).length;
    return sizeBytes <= MAX_PAYLOAD_SIZE_BYTES;
  },
  {
    message: `Payload size exceeds maximum allowed size of ${MAX_PAYLOAD_SIZE_BYTES} bytes (150KB)`,
  }
);

/**
 * Validate a web-draft payload using Zod
 * 
 * @param payload - The payload to validate
 * @returns Validation result with parsed payload or error
 */
export function validateWebDraftPayload(
  payload: unknown
): { success: true; data: WebDraftPayload } | { success: false; error: string } {
  const result = webDraftPayloadSchema.safeParse(payload);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Extract error message from Zod validation errors
  const errorMessages = result.error.issues.map((err) => {
    const path = err.path.length > 0 ? `${err.path.join(".")}: ` : "";
    return `${path}${err.message}`;
  });

  return {
    success: false,
    error: errorMessages.join("; "),
  };
}

/**
 * Type guard for web-draft payload using Zod validation
 * 
 * @param payload - The payload to check
 * @returns True if payload is a valid WebDraftPayload
 */
export function isValidWebDraftPayload(
  payload: unknown
): payload is WebDraftPayload {
  return validateWebDraftPayload(payload).success;
}

