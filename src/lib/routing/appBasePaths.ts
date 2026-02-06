export const PREMIUM_BASE_PATH = "/";
export const DEMO_BASE_PATH = "/apps";

export function isDemoPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === DEMO_BASE_PATH || pathname.startsWith(`${DEMO_BASE_PATH}/`);
}

function stripTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function stripLeadingSlash(path: string): string {
  if (path.startsWith("/")) return path.slice(1);
  return path;
}

/**
 * Joins a base path and a route path segment safely.
 *
 * Examples:
 * - joinBasePath("/", "review-responder") => "/review-responder"
 * - joinBasePath("/apps", "review-responder") => "/apps/review-responder"
 * - joinBasePath("/apps", "/review-responder") => "/apps/review-responder"
 */
export function joinBasePath(basePath: string, routePath: string): string {
  const base = basePath === "/" ? "" : stripTrailingSlash(basePath);
  const tail = stripLeadingSlash(routePath);
  const joined = `${base}/${tail}`.replace(/\/+/g, "/");
  return joined === "" ? "/" : joined;
}

export function dashboardHrefForPathname(pathname: string | null | undefined): string {
  return isDemoPathname(pathname) ? DEMO_BASE_PATH : PREMIUM_BASE_PATH;
}

export function toolHrefForPathname(toolSlug: string, pathname: string | null | undefined): string {
  return joinBasePath(dashboardHrefForPathname(pathname), toolSlug);
}

/**
 * Converts a known-premium href (e.g. "/review-responder") to demo ("/apps/review-responder")
 * and vice-versa, based on pathname.
 *
 * This is intentionally forgiving: if the input href already matches the mode, it returns it.
 */
export function normalizeAppHrefForPathname(
  href: string,
  pathname: string | null | undefined
): string {
  if (!href.startsWith("/")) return href;

  const inDemo = isDemoPathname(pathname);

  if (inDemo) {
    if (href === "/") return DEMO_BASE_PATH;
    if (href === DEMO_BASE_PATH || href.startsWith(`${DEMO_BASE_PATH}/`)) return href;
    return joinBasePath(DEMO_BASE_PATH, href);
  }

  // Premium
  if (href === DEMO_BASE_PATH) return PREMIUM_BASE_PATH;
  if (href.startsWith(`${DEMO_BASE_PATH}/`)) return href.slice(DEMO_BASE_PATH.length) || "/";
  return href;
}

