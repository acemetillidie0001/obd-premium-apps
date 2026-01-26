import { cookies } from "next/headers";

import BusinessAccessGate from "@/components/guards/BusinessAccessGate";
import { auth } from "@/lib/auth";
import { hasDemoCookie } from "@/lib/demo/demo-cookie";
import { getBusinessAccessGateMode } from "@/lib/auth/business-access-gate.server";

export const runtime = "nodejs";

export default async function FaqGeneratorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const cookieStore = await cookies();
  const isDemo = hasDemoCookie(cookieStore);

  const mode = await getBusinessAccessGateMode({ userId, isDemo });

  if (mode === "noBusiness") {
    return (
      <BusinessAccessGate
        mode="noBusiness"
        primaryAction={{ href: "/apps/brand-profile", label: "Open Brand Profile" }}
      />
    );
  }

  if (mode === "noMembership") {
    return (
      <BusinessAccessGate
        mode="noMembership"
        primaryAction={{ href: "/apps/teams-users", label: "Open Teams & Users" }}
      />
    );
  }

  return <>{children}</>;
}

