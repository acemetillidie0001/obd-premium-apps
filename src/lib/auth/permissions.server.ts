import "server-only";

import { BusinessContextError, requireBusinessContext, type BusinessContext } from "@/lib/auth/requireBusinessContext";
import { canUser, type ActionKey, type AppKey, type PermissionContextSelector } from "@/lib/auth/permissions";

/**
 * Require a permission for the current authenticated business context.
 *
 * Overloads supported:
 * - requirePermission(app, action)
 * - requirePermission(selector, app, action)
 *
 * Throws BusinessContextError with a typed 403 when permission is denied.
 */
export async function requirePermission(app: AppKey, action: ActionKey): Promise<BusinessContext>;
export async function requirePermission(
  selector: PermissionContextSelector,
  app: AppKey,
  action: ActionKey
): Promise<BusinessContext>;
export async function requirePermission(
  a: PermissionContextSelector | AppKey,
  b: AppKey | ActionKey,
  c?: ActionKey
): Promise<BusinessContext> {
  const selector: PermissionContextSelector | undefined = c ? (a as PermissionContextSelector) : undefined;
  const app: AppKey = c ? (b as AppKey) : (a as AppKey);
  const action: ActionKey = c ? c : (b as ActionKey);

  const ctx = await requireBusinessContext(selector);
  if (!canUser(ctx.role, app, action)) throw new BusinessContextError("Forbidden", 403, "FORBIDDEN");
  return ctx;
}

