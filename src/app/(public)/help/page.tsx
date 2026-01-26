import { redirect } from "next/navigation";

/**
 * Keep /help stable (footer link, prefetch) but route users
 * to the new public Help Center experience.
 */
export default function HelpPage() {
  redirect("/help-center");
}

