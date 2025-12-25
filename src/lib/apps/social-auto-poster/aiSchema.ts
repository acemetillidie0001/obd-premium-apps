/**
 * Zod schemas for validating AI-generated JSON responses
 * 
 * Used in the generate route to ensure AI responses match expected structure.
 */

import { z } from "zod";

// Valid enum values
const SOCIAL_PLATFORMS = ["facebook", "instagram", "x", "googleBusiness"] as const;
const CONTENT_THEMES = ["education", "promotion", "social_proof", "community", "seasonal", "general"] as const;

// Metadata schema (optional fields)
const postMetadataSchema = z.object({
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
}).passthrough(); // Allow additional fields but validate known ones

// SocialPostDraft schema
export const socialPostDraftSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  content: z.string(),
  characterCount: z.number().int().nonnegative(),
  reason: z.string().optional(),
  theme: z.enum(CONTENT_THEMES).optional(),
  isSimilar: z.boolean().optional(),
  metadata: postMetadataSchema.optional(),
}).passthrough();

// SocialPostPreview schema (includes additional fields)
export const socialPostPreviewSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  content: z.string(),
  characterCount: z.number().int().nonnegative(),
  maxCharacters: z.number().int().positive(),
  isValid: z.boolean(),
  preview: z.string(),
  reason: z.string().optional(),
  theme: z.enum(CONTENT_THEMES).optional(),
  isSimilar: z.boolean().optional(),
  metadata: postMetadataSchema.optional(),
}).passthrough();

// Variants schema (record of platform -> array of drafts)
export const variantsSchema = z.record(
  z.enum(SOCIAL_PLATFORMS),
  z.array(socialPostDraftSchema)
);

// Full GeneratePostsResponse schema
export const generatePostsResponseSchema = z.object({
  drafts: z.array(socialPostDraftSchema),
  previews: z.array(socialPostPreviewSchema),
  variants: variantsSchema.optional(),
}).passthrough();

