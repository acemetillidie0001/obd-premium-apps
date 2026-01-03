/**
 * Client-side utility for pushing BDW content to AI Help Desk Knowledge
 * 
 * This is a safe, fail-safe integration that gracefully handles errors
 * and does not break BDW if AI Help Desk is missing or disabled.
 */

export interface PushToHelpDeskPayload {
  businessId: string;
  title: string;
  content: string;
  tags?: string[];
}

export interface PushToHelpDeskResult {
  success: boolean;
  error?: string;
  entryId?: string;
}

/**
 * Attempts to push business description content to AI Help Desk Knowledge
 * 
 * @param payload - The knowledge entry payload
 * @returns Result with success status and optional error/entryId
 */
export async function attemptPushToHelpDeskKnowledge(
  payload: PushToHelpDeskPayload
): Promise<PushToHelpDeskResult> {
  try {
    const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: payload.businessId.trim(),
        type: "NOTE" as const, // Using NOTE type for business descriptions
        title: payload.title.trim(),
        content: payload.content.trim(),
        tags: payload.tags || ["business-overview", "bdw"],
        isActive: true,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      const errorMessage = json.error || "Failed to add to knowledge base";
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      entryId: json.data?.id,
    };
  } catch (error) {
    // Gracefully handle network errors, missing endpoints, etc.
    console.error("Error pushing to AI Help Desk:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

