"use client";

// One box, because there was never a reason for two.
//
// The search behind it already matched keywords AND authors AND both together;
// splitting the interface into "keyword" and "author" asked visitors to
// classify their own question before they were allowed to ask it. Only ever
// reaches published, public material.

export default function HeroSearch() {
  return (
    <form action="/search" method="get" role="search"
          aria-label="Search published scholarship by keyword or author"
          style={{ maxWidth: 620, margin: "0 auto" }}>
      <label htmlFor="hero-q" className="hp">
        Search for keyword or author or keyword + author
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="hero-q" name="q"
               placeholder="Search for keyword or author or keyword + author"
               style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,.07)",
                        borderColor: "#3a4c66", color: "#fff" }} />
        <button className="btn btn-primary" style={{ padding: "13px 22px", flexShrink: 0 }}>
          Search
        </button>
      </div>
    </form>
  );
}
