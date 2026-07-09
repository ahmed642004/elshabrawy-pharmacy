// Single source of truth for the site's public base URL — used by canonical
// URLs, Open Graph tags, JSON-LD, robots.txt, and the sitemap. Must not have
// a trailing slash.
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
