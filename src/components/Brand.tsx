// The connected-tree-over-open-book mark, as inline SVG so it scales and
// inherits theme colours without a network request.
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Semantic Authoring">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M32 42V22" />
        <path d="M32 30c-4-3-9-4-12-9" />
        <path d="M32 27c4-3 9-5 12-10" />
        <path d="M32 34c-3-1-6-1-9 2" />
        <path d="M32 36c3-1 7 0 9 3" />
      </g>
      <g fill="currentColor">
        <circle cx="32" cy="19" r="3.1" opacity=".95" />
        <circle cx="19" cy="20" r="2.6" opacity=".75" />
        <circle cx="45" cy="16" r="2.6" opacity=".85" />
        <circle cx="22" cy="36" r="2.2" opacity=".6" />
        <circle cx="42" cy="39" r="2.2" opacity=".7" />
      </g>
      <path
        d="M10 44c8-4 14-4 22 1 8-5 14-5 22-1v6c-8-4-14-4-22 1-8-5-14-5-22-1z"
        fill="currentColor"
        opacity=".9"
      />
    </svg>
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
