// Sanitiser for the one place scholars can author HTML: the About Me on a
// public profile.
//
// Allow-list, never a block-list. A block-list is a guess about every attack
// anyone will ever invent; an allow-list is a statement about the handful of
// tags a biography actually needs. Anything not named here is dropped.
//
// Runs on save rather than on render, so the stored value is already safe and
// a future render path cannot forget to clean it.

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "blockquote",
  "h2", "h3", "h4", "a",
]);

// Only href, only on <a>, and only to somewhere that cannot execute script.
const SAFE_HREF = /^(https?:\/\/|mailto:|\/)/i;

export function sanitizeRichText(input: string, maxLength = 20000): string {
  if (!input) return "";
  let html = input.slice(0, maxLength);

  // Remove whole elements whose *content* is dangerous, not just their tags —
  // stripping <script> alone would leave its body as visible text.
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*\/?>/gi, "");
  // HTML comments can hide conditional-comment payloads.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const closing = /^<\//.test(_m);
    if (closing) return `</${tag}>`;

    if (tag === "a") {
      const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const value = (href?.[2] ?? href?.[3] ?? href?.[4] ?? "").trim();
      if (!SAFE_HREF.test(value)) return "<a>";
      const safe = value.replace(/"/g, "&quot;");
      // Links leave to somewhere we do not control; deny the new page any
      // handle back to this one.
      return `<a href="${safe}" rel="nofollow ugc noopener noreferrer" target="_blank">`;
    }

    // Every other allowed tag keeps no attributes at all — that removes
    // style, on* handlers, srcset and anything else in one stroke.
    return `<${tag}>`;
  });

  return html.trim();
}

/** Plain text of sanitised HTML, for meta descriptions and structured data. */
export function stripTags(html: string, max = 300): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
