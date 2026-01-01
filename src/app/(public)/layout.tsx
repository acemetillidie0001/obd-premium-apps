/**
 * Minimal layout for public routes (booking, help)
 * Completely isolated from root layout to prevent hook order mismatches
 * and shared component/provider issues.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

