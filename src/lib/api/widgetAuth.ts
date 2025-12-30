/**
 * Widget Authentication Utility
 * 
 * Validates widget requests using businessId + publicKey.
 */

import { prisma } from "@/lib/prisma";

/**
 * Validate widget key for a business
 * 
 * @param businessId - The business ID
 * @param publicKey - The public key from the widget request
 * @returns true if valid, false otherwise
 */
export async function validateWidgetKey(
  businessId: string,
  publicKey: string
): Promise<boolean> {
  try {
    const widgetKey = await prisma.aiHelpDeskWidgetKey.findUnique({
      where: { businessId },
    });

    if (!widgetKey) {
      return false;
    }

    // Compare keys (constant-time comparison would be better for production, but for V4 this is acceptable)
    // Note: For enhanced security, consider using crypto.timingSafeEqual in future versions
    return widgetKey.publicKey === publicKey;
  } catch (error) {
    console.error("Widget key validation error:", error);
    return false;
  }
}

/**
 * Generate a new widget key
 * 
 * @returns A random 16-character alphanumeric key
 */
export function generateWidgetKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

/**
 * Get or create widget key for a business
 * 
 * @param businessId - The business ID
 * @returns The public key
 */
export async function getOrCreateWidgetKey(businessId: string): Promise<string> {
  try {
    let widgetKey = await prisma.aiHelpDeskWidgetKey.findUnique({
      where: { businessId },
    });

    if (!widgetKey) {
      // Create new key
      const publicKey = generateWidgetKey();
      widgetKey = await prisma.aiHelpDeskWidgetKey.create({
        data: {
          businessId,
          publicKey,
        },
      });
    }

    return widgetKey.publicKey;
  } catch (error) {
    console.error("Get or create widget key error:", error);
    throw error;
  }
}

/**
 * Rotate widget key for a business
 * 
 * @param businessId - The business ID
 * @returns The new public key
 */
export async function rotateWidgetKey(businessId: string): Promise<string> {
  const publicKey = generateWidgetKey();

  await prisma.aiHelpDeskWidgetKey.upsert({
    where: { businessId },
    update: {
      publicKey,
      rotatedAt: new Date(),
    },
    create: {
      businessId,
      publicKey,
    },
  });

  return publicKey;
}

