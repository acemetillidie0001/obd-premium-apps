// Force dynamic rendering - prevent prerender during build
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Import the client component directly
// The dynamic exports above prevent prerendering during build
import SetupPageClient from "./SetupPageClient";

export default function SetupPage() {
  return <SetupPageClient />;
}
