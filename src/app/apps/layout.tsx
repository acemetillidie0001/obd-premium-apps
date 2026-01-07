/**
 * Apps Layout
 * 
 * Ensures all /apps and /apps/* routes share the same layout tree.
 * This prevents the launcher (/apps) from drifting into a different shell
 * compared to app pages (/apps/*).
 * 
 * All /apps routes inherit:
 * - Root layout (header, footer, ConditionalLayout)
 * - OBDPageContainer (sidebar + content shell) from individual pages
 * 
 * This layout serves as a passthrough to ensure consistency.
 */
export default function AppsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Passthrough - ensures /apps and /apps/* share the same layout tree
  return <>{children}</>;
}

