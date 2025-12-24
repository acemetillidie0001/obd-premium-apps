import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginFormClient from "./LoginFormClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; next?: string; error?: string };
}) {
  // Server-side check: Only redirect if session is definitively authenticated (has email)
  // This prevents redirect loops by ensuring we only redirect when we have a valid, complete session
  const session = await auth();
  if (session?.user?.email) {
    // Get callbackUrl, but never redirect to /login or /login/* paths
    const callbackUrl = searchParams.callbackUrl || searchParams.next || "/";
    // Strip /login paths to prevent loops - always redirect to / if callbackUrl points to login
    const redirectUrl = callbackUrl.startsWith("/login") ? "/" : callbackUrl;
    redirect(redirectUrl);
  }

  // User is not authenticated (no email), show login form
  return <LoginFormClient />;
}
