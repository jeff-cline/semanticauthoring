"use client";

// Two entry points, because people arrive looking for different things:
// one searches the work, the other searches the work AND the people.
// Both only ever reach published, public material.

export default function HeroSearch() {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                  maxWidth: 720, margin: "0 auto" }}>
      <form action="/search" method="get" role="search"
            aria-label="Search published scholarship by keyword">
        <label htmlFor="hero-q" className="hp">Search for keyword</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="hero-q" name="q" placeholder="Search for keyword"
                 style={{ background: "rgba(255,255,255,.07)", borderColor: "#3a4c66",
                          color: "#fff" }} />
          <button className="btn btn-primary" style={{ padding: "13px 18px" }}>Search</button>
        </div>
      </form>

      <form action="/search" method="get" role="search"
            aria-label="Search published scholarship by keyword or author">
        <label htmlFor="hero-a" className="hp">Keyword or author</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="hero-a" name="author" placeholder="Keyword or author"
                 style={{ background: "rgba(255,255,255,.07)", borderColor: "#3a4c66",
                          color: "#fff" }} />
          <button className="btn btn-secondary"
                  style={{ padding: "13px 18px", color: "#dbe4f0", borderColor: "#3a4c66" }}>
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
