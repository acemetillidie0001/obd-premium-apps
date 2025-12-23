import { redirect } from "next/navigation";

/**
 * Redirect from /local-hiring-assistant to /apps/local-hiring-assistant
 * This ensures all premium apps use the /apps/* namespace for auth protection
 */
export default function LocalHiringAssistantRedirect() {
  redirect("/apps/local-hiring-assistant");
}
