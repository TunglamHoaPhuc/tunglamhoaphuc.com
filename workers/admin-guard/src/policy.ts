const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Admin endpoints with side effects (WordPress sync, uploads, file rename/delete,
// link repair, outbound fetches). The public site never calls them, so they need
// a signed-in editor whatever the HTTP method.
const SIDE_EFFECT_SEGMENTS = [
  "/sync-wp",
  "/wp-post-create",
  "/wp-media",
  "/repair-links",
  "/upload",
  "/fetch-metadata",
];

export type Decision = "pass" | "require-login";

export function normalizePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  return decoded.replace(/\/{2,}/g, "/").toLowerCase();
}

export function decide(method: string, pathname: string): Decision {
  const path = normalizePath(pathname);
  if (path === null) return "require-login";
  if (!path.startsWith("/api/admin")) return "pass";
  if (!READ_METHODS.has(method.toUpperCase())) return "require-login";
  return SIDE_EFFECT_SEGMENTS.some((segment) => path.includes(segment))
    ? "require-login"
    : "pass";
}
