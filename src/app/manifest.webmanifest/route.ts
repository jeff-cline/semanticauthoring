import { NextResponse } from "next/server";
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    name: "Semantic Authoring",
    short_name: "Authoring",
    description: "The operating system for scholarly thinking.",
    start_url: "/app/mobile",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17243A",
    theme_color: "#17243A",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Capture a thought", url: "/app/mobile" },
      { name: "Daily journal", url: "/app/journal" },
      { name: "Embodied Inquiry", url: "/app/inquiry" },
      { name: "My reading", url: "/app/reading" },
    ],
  }, { headers: { "content-type": "application/manifest+json" } });
}
