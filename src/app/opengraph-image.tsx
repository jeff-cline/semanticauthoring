import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Semantic Authoring — the operating system for scholarly thinking";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: "#17243A",
          color: "#ffffff", fontFamily: "Georgia, serif", padding: 80, textAlign: "center",
        }}
      >
        <div style={{ display: "flex", gap: 14, marginBottom: 34 }}>
          {["#176B73", "#8FB8AE", "#D96C59", "#C6A15B"].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
          ))}
        </div>
        <div style={{ fontSize: 66, letterSpacing: 6, lineHeight: 1.1 }}>
          SEMANTIC AUTHORING
        </div>
        <div style={{ fontSize: 30, color: "#C6A15B", marginTop: 26, fontStyle: "italic" }}>
          The operating system for scholarly thinking.
        </div>
        <div style={{ fontSize: 21, color: "#93a7c4", marginTop: 44, letterSpacing: 3 }}>
          READ · CONNECT · SYNTHESIZE · AUTHOR · REVIEW · PUBLISH · CELEBRATE
        </div>
      </div>
    ),
    { ...size },
  );
}
