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
// Handles live at the site root (semanticauthoring.org/first-last), so a
// handle must never collide with a real top-level page. Next resolves static
// segments first, which means a colliding handle is not a security problem —
// it is simply unreachable, which is worse to discover after you have printed
// it on a CV. Every real route at src/app/* belongs in this list.
export const RESERVED = new Set([
  // real top-level routes
  "about", "advising", "answers", "api", "app", "change-password", "discover",
  "feed.xml", "forgot", "join", "journey", "login", "logout", "mission",
  "offline", "peer-review", "pricing", "privacy", "reset", "review", "s",
  "scholars", "search", "sso", "subscribed", "terms", "testimonial",
  "unsubscribe", "sitemap.xml", "robots.txt", "llms.txt", "icon.svg",
  "manifest.webmanifest", "opengraph-image",
  // kept clear for future use and for the obvious impostor cases
  "admin", "settings", "help", "support", "new", "edit", "account", "profile",
  "dashboard", "signup", "signin", "sign-in", "sign-up", "auth", "static",
  "public", "assets", "images", "img", "css", "js", "_next",
  "null", "undefined", "true", "false",
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
