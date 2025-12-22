import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

/**
 * Get or create the OpenAI client instance.
 * This lazy initialization prevents build-time errors when the API key isn't available.
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not set. Please configure it in your environment variables."
      );
    }
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  return openaiClient;
}

