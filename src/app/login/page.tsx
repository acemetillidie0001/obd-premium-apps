import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginFormClient from "./LoginFormClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; next?: string; error?: string };
}) {
  // Server-side check: If user is already authenticated, redirect to dashboard
  const session = await auth();
  if (session?.user) {
    // Get callbackUrl, but never redirect to /login
    const callbackUrl = searchParams.callbackUrl || searchParams.next || "/";
    const redirectUrl = callbackUrl === "/login" ? "/" : callbackUrl;
    redirect(redirectUrl);
  }

  // User is not authenticated, show login form
  return <LoginFormClient />;
}
