import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Profile photo upload, relayed through the Core so images are hosted and kept
// across deploys rather than written onto this app's disk.
//
// The Core credentials never leave the server: the browser posts here, and this
// route forwards with the key. Nothing about the Core is visible to the client.

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const base = process.env.CORE_API_BASE;
  const key = process.env.CORE_API_KEY;
  const secret = process.env.CORE_API_SECRET;
  if (!base || !key || !secret) {
    return NextResponse.json({ ok: false, error: "Image hosting is not configured." },
      { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "Choose an image first." },
    { status: 400 });

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Use a JPEG, PNG, WebP or AVIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "That image is larger than 5 MB." }, { status: 400 });
  }

  // Name the file after the scholar. The filename is the one piece of an image
  // a search engine reads directly, so "krystalore-crews.jpg" is worth more
  // than "IMG_4821.jpg" — and it is her name, which is the search term.
  const profile = await one<any>(
    `SELECT handle, display_name FROM profiles WHERE user_id=$1`, [user.id]).catch(() => null);
  const stem = profile?.handle
    || slugify(profile?.display_name || user.name || user.email.split("@")[0], "scholar");
  const ext = file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : file.type === "image/avif" ? "avif" : "jpg";

  const out = new FormData();
  out.append("file", file, `${stem}.${ext}`);
  out.append("label", `Profile photo — ${profile?.display_name || user.name || stem}`);

  const res = await fetch(`${base.replace(/\/$/, "")}/api/core/upload`, {
    method: "POST",
    headers: { "x-core-key": key, "x-core-secret": secret },
    body: out,
  }).catch(() => null);

  const json = await res?.json().catch(() => null);
  if (!res?.ok || !json?.ok || !json.url) {
    return NextResponse.json(
      { ok: false, error: json?.error || "The image could not be uploaded." },
      { status: 502 });
  }

  return NextResponse.json({ ok: true, url: json.url });
}
