import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasDemoCookie } from "@/lib/demo/demo-cookie";
import AppsLauncherClient from "./AppsLauncherClient";

export default async function AppsPage() {
  const session = await auth();
  
  // Allow demo mode to bypass login redirect (view-only access)
  const cookieStore = await cookies();
  const isDemo = hasDemoCookie(cookieStore);

  if (!session?.user && !isDemo) {
    redirect("/login?callbackUrl=/apps");
  }

  return <AppsLauncherClient />;
}
