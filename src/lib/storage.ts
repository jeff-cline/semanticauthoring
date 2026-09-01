import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

// Private file storage. Deliberately OUTSIDE the web root and outside the repo:
// uploaded material is a scholar's private library and may include publisher
// PDFs, which must never be reachable by URL. Files are streamed back only
// through an authenticated route that checks ownership (spec §17).

export const STORAGE_DIR =
  process.env.FILE_STORAGE_DIR ?? "/var/lib/semanticauthoring/files";

export const MAX_BYTES = 40 * 1024 * 1024;   // 40 MB

const ALLOWED = new Map<string, string>([
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
  ["text/markdown", ".md"],
  ["application/epub+zip", ".epub"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
]);

export function allowedType(mime: string): boolean {
  return ALLOWED.has(mime);
}

export interface Stored { path: string; name: string; size: number }

export async function storeFile(ownerId: number, file: File): Promise<Stored | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new Error("File is larger than 40 MB.");
  if (!allowedType(file.type)) throw new Error("That file type isn't supported.");

  const dir = join(STORAGE_DIR, String(ownerId));
  await mkdir(dir, { recursive: true, mode: 0o700 });

  // Generated name — never trust the client's filename on disk.
  const ext = ALLOWED.get(file.type) ?? extname(file.name).slice(0, 8) ?? "";
  const stored = `${randomBytes(16).toString("hex")}${ext}`;
  const full = join(dir, stored);

  await writeFile(full, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });

  return {
    path: full,
    name: file.name.slice(0, 250).replace(/[\r\n]/g, ""),
    size: file.size,
  };
}

export async function removeFile(path: string) {
  if (!path || !path.startsWith(STORAGE_DIR)) return;   // never delete outside storage
  await unlink(path).catch(() => {});
}
