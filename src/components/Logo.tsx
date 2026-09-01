// Semantic Authoring mark — a semantic tree growing from an open book.
// Drawn as SVG so it scales cleanly, adapts to light and dark surfaces, and
// costs no network request. Node colours are the brand palette; the book and
// branches take `currentColor` so the mark inverts correctly on any ground.

const NODES: [number, number, number, string, number?][] = [
  // x, y, r, fill, opacity
  [60, 40, 6.4, "#C6A15B"],          // crown — Champagne Gold
  [37, 52, 5.6, "#176B73"],          // Deep Current
  [83, 46, 5.2, "#D96C59"],          // Warm Coral
  [43, 35, 4.6, "#F2EFE8"],          // pale
  [78, 31, 4.4, "#8FB8AE"],          // Sea Glass
  [50, 27, 4.0, "#D96C59"],
  [68, 24, 3.6, "#176B73"],
  [30, 42, 3.4, "#8FB8AE"],
  [90, 36, 3.4, "#C6A15B"],
  [60, 55, 3.2, "#17243A", 0.85],
  [72, 62, 3.0, "#F2EFE8", 0.9],
  [47, 63, 2.8, "#176B73", 0.9],
];

export function Mark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className}
         role="img" aria-label="Semantic Authoring">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M60 84 L60 44" />
        <path d="M60 72 C54 68 45 63 38 53" />
        <path d="M60 64 C67 60 76 55 82 47" />
        <path d="M60 56 C54 50 48 44 44 36" />
        <path d="M60 50 C65 44 72 38 77 32" />
        <path d="M60 46 C57 40 54 34 51 28" />
        <path d="M60 44 C62 38 65 32 67 26" />
        <path d="M60 70 C52 64 44 56 31 43" />
        <path d="M60 62 C70 56 80 48 89 37" />
        <path d="M60 68 C64 66 69 64 72 63" />
        <path d="M60 66 C56 65 51 64 48 63" />
      </g>

      {/* gold connective threads — the "semantic" strands */}
      <g fill="none" stroke="#C6A15B" strokeWidth="1.9" strokeLinecap="round" opacity=".95">
        <path d="M60 58 C68 53 74 47 78 39" />
        <path d="M60 66 C52 62 46 57 42 50" />
        <path d="M60 78 C60 66 60 54 60 44" opacity=".55" />
      </g>

      {NODES.map(([cx, cy, r, fill, o], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={fill} opacity={o ?? 1} />
      ))}

      {/* open book */}
      <g>
        <path d="M11 84 C28 75 46 77 59 88 L59 102 C46 92 28 90 11 98 Z"
              fill="currentColor" opacity=".92" />
        <path d="M109 84 C92 75 74 77 61 88 L61 102 C74 92 92 90 109 98 Z"
              fill="currentColor" opacity=".92" />
        <g fill="none" stroke="#C6A15B" strokeWidth="1.8" strokeLinecap="round" opacity=".9">
          <path d="M18 88 C31 83 45 85 56 92" />
          <path d="M102 88 C89 83 75 85 64 92" />
        </g>
      </g>
    </svg>
  );
}

/** Horizontal lockup: mark, rule, wordmark, tagline. */
export function Lockup({ size = 34, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
      <Mark size={size} />
      <span aria-hidden="true"
            style={{ width: 1, height: size * 0.86, background: "currentColor", opacity: .28 }} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={{ fontFamily: "var(--serif)", letterSpacing: ".17em",
                       fontSize: size * 0.36, textTransform: "uppercase" }}>
          Semantic<br />Authoring
        </span>
        {tagline && (
          <span style={{ fontFamily: "var(--serif)", fontStyle: "italic",
                         fontSize: size * 0.235, color: "var(--gold)", marginTop: 4 }}>
            The operating system for scholarly thinking.
          </span>
        )}
      </span>
    </span>
  );
}

export const JOURNEY = [
  { key: "read", label: "Read", cls: "stage-read", line: "Bring the literature in — PDFs, articles, books, lectures — and read with your questions beside you." },
  { key: "connect", label: "Connect", cls: "stage-connect", line: "Link ideas to ideas, and yourself to mentors, cohorts, and communities." },
  { key: "synthesize", label: "Synthesize", cls: "stage-synthesize", line: "Move from collecting information to developing a position of your own." },
  { key: "author", label: "Author", cls: "stage-author", line: "Write with your sources, notes, and contradictions within reach." },
  { key: "review", label: "Review", cls: "stage-review", line: "Share exactly what you choose with mentors and committee — nothing more." },
  { key: "publish", label: "Publish", cls: "stage-publish", line: "Move finished work into the world, deliberately and on your terms." },
  { key: "celebrate", label: "Celebrate", cls: "stage-celebrate", line: "Scholarship takes years. The milestones along the way deserve to be seen." },
];
