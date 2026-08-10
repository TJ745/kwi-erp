/**
 * Post-login redirect validation — docs/SECURITY.md §8.
 *
 * Accepts only same-site absolute paths. Rejects protocol-relative URLs
 * ("//evil.com"), absolute URLs, and backslash variants that some browsers
 * normalise into a host, all of which would be open redirects.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target) return fallback;

  const value = target.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\")) return fallback;
  // Reject anything carrying a scheme, encoded or not.
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;
  if (value.toLowerCase().includes("javascript:")) return fallback;

  return value;
}
