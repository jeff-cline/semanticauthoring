import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { STORAGE_DIR } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Authenticated file streaming. Ownership is checked on every request, and the
// path is confined to the storage root — a scholar's private library is never
// reachable by guessing a URL.

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".epub": "application/epub+zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const row = await one<any>(
    `SELECT file_path, file_name FROM sources WHERE id=$1 AND owner_id=$2`,
    [Number(id), user.id]);

  if (!row?.file_path) return new NextResponse("Not found", { status: 404 });
  if (!row.file_path.startsWith(STORAGE_DIR)) return new NextResponse("Forbidden", { status: 403 });

  try {
    const info = await stat(row.file_path);
    const ext = row.file_path.slice(row.file_path.lastIndexOf("."));
    const stream = createReadStream(row.file_path);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "content-length": String(info.size),
        "content-disposition": `inline; filename="${basename(row.file_name || "document")}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
