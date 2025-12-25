/**
 * OBD Brand-Safe Image Generator - Vercel Blob Storage
 * 
 * Stores generated images in Vercel Blob storage for production.
 * 
 * TODO: Implement Vercel Blob integration once @vercel/blob is added to dependencies.
 * For now, this is a placeholder that falls back to local storage.
 */

import type { ImageStorage } from "../types";
import { localDevStorage } from "./localDev";

/**
 * Vercel Blob storage adapter.
 * 
 * TODO: Implement actual Vercel Blob integration:
 * ```ts
 * import { put } from '@vercel/blob';
 * 
 * export const vercelBlobStorage: ImageStorage = {
 *   async put(args) {
 *     const blob = await put(args.key, args.bytes, {
 *       access: 'public',
 *       contentType: args.contentType,
 *     });
 *     return { url: blob.url };
 *   },
 * };
 * ```
 * 
 * For now, falls back to local storage.
 */
export const vercelBlobStorage: ImageStorage = {
  async put(args) {
    // TODO: Implement Vercel Blob integration
    // For now, use local storage as fallback
    console.warn(
      "[ImageEngine] Vercel Blob storage not yet implemented, using local fallback"
    );
    return localDevStorage.put(args);
  },
};

