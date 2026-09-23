import "server-only";
import { q } from "./db";

// Every Word document she generates is kept, byte for byte.
//
// Not a recipe for regenerating one — the actual file. If she hands a journal
// to a professor and is later asked what she submitted, regenerating from the
// live journal would produce a *different* document, because she will have
// kept writing. The saved copy is the answer to "what did I hand in."

const KEEP_PER_KIND = 40;

export async function recordExport(opts: {
  ownerId: number;
  kind: "inquiry" | "journal";
  title: string;
  scope: string;
  filename: string;
  content: Buffer | Uint8Array;
}): Promise<void> {
  const buf = Buffer.from(opts.content);
  await q(
    `INSERT INTO saved_exports (owner_id, kind, title, scope, filename, content, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [opts.ownerId, opts.kind, opts.title.slice(0, 300), opts.scope.slice(0, 300),
     opts.filename.slice(0, 300), buf, buf.byteLength],
  );

  // Keep the shelf from growing without bound. Oldest go first, and only
  // within the same kind, so a burst of journal exports cannot evict the
  // coursework she may need to produce months from now.
  await q(
    `DELETE FROM saved_exports
      WHERE owner_id=$1 AND kind=$2
        AND id NOT IN (
          SELECT id FROM saved_exports WHERE owner_id=$1 AND kind=$2
           ORDER BY created_at DESC LIMIT $3)`,
    [opts.ownerId, opts.kind, KEEP_PER_KIND],
  );
}

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
