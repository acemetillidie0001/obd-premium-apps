// Force dynamic rendering at route level (server component wrapper)
// This ensures the route is always dynamic, preventing static optimization
export const dynamic = "force-dynamic";
export const revalidate = 0;

import HomeClient from "@/app/HomeClient";

// Server component wrapper that forces dynamic rendering
export default function Home() {
  return <HomeClient />;
}

