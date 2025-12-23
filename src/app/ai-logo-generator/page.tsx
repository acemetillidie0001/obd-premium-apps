import { redirect } from "next/navigation";

/**
 * Redirect from /ai-logo-generator to /apps/ai-logo-generator
 * This ensures all premium apps use the /apps/* namespace for auth protection
 */
export default function AiLogoGeneratorRedirect() {
  redirect("/apps/ai-logo-generator");
}

