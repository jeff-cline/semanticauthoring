export function slugify(input: string, fallback = "untitled"): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || fallback;
}

/** Reserved so a handle can never shadow a real route. */
export const RESERVED = new Set([
  "app", "api", "login", "logout", "join", "about", "mission", "pricing", "privacy",
  "terms", "answers", "search", "scholars", "discover", "s", "review", "testimonial",
  "subscribed", "change-password", "sitemap.xml", "robots.txt", "llms.txt", "icon.svg",
  "admin", "settings", "help", "support", "new", "edit", "null", "undefined",
]);

export function handleProblem(h: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(h)) {
    return "Use 3–30 characters: lowercase letters, numbers, and hyphens.";
  }
  if (RESERVED.has(h)) return "That handle is reserved.";
  return null;
}

export const readingTime = (text: string) =>
  Math.max(1, Math.round((text.trim().split(/\s+/).filter(Boolean).length || 0) / 225));
