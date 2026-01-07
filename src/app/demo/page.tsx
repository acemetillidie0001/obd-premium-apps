/**
 * Demo Mode Entry Route
 * 
 * Sets the demo mode cookie if it's missing, then redirects to the apps dashboard.
 * This route enables demo mode for users visiting /demo.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasDemoCookie, setDemoCookie } from "@/lib/demo/demo-cookie";

// Force dynamic rendering (uses cookies() and redirect())
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DemoPage() {
  // Get cookies instance
  const cookieStore = await cookies();
  
  // Check if demo cookie already exists
  if (!hasDemoCookie(cookieStore)) {
    // Set demo cookie if it's missing
    setDemoCookie(cookieStore);
  }
  
  // Redirect to apps dashboard
  redirect("/apps");
}

