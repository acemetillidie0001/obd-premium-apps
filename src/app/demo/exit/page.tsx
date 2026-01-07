/**
 * Demo Mode Exit Route
 * 
 * Clears the demo mode cookie and redirects to the external dashboard preview page.
 * This route disables demo mode for users visiting /demo/exit.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearDemoCookie } from "@/lib/demo/demo-cookie";

// Force dynamic rendering (uses cookies() and redirect())
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DemoExitPage() {
  // Get cookies instance
  const cookieStore = await cookies();
  
  // Clear the demo cookie
  clearDemoCookie(cookieStore);
  
  // Redirect to external dashboard preview page
  redirect("https://ocalabusinessdirectory.com/premium/dashboard-preview/");
}

