import "server-only";
import { q, one } from "./db";

export async function notify(
  ownerId: number, kind: string, title: string,
  opts: { body?: string; href?: string } = {},
) {
  // Respect the scholar's preferences; silence is a feature.
  const prefs = await one<any>(
    `SELECT * FROM notification_prefs WHERE owner_id=$1`, [ownerId]).catch(() => null);
  const allowed: Record<string, boolean> = {
    citation: prefs?.citations ?? true,
    retraction: prefs?.citations ?? true,
    deadline: prefs?.deadlines ?? true,
    review: prefs?.reviews ?? true,
    advising: prefs?.advising ?? true,
    group: prefs?.groups ?? true,
    milestone: true, system: true,
  };
  if (allowed[kind] === false) return;

  await q(
    `INSERT INTO notifications (owner_id, kind, title, body, href) VALUES ($1,$2,$3,$4,$5)`,
    [ownerId, kind, title.slice(0, 300), (opts.body ?? "").slice(0, 2000),
     (opts.href ?? "").slice(0, 300)],
  ).catch(() => {});
}

export async function unreadCount(ownerId: number): Promise<number> {
  const r = await one<{ n: string }>(
    `SELECT count(*) n FROM notifications WHERE owner_id=$1 AND read_at IS NULL`, [ownerId])
    .catch(() => null);
  return Number(r?.n ?? 0);
}

/**
 * Deadline sweep. Generates notifications for course items, chapters, revisions,
 * and reviews that fall due soon — and does not repeat itself, because a
 * notification system that nags is one people switch off.
 */
export async function sweepDeadlines(ownerId: number): Promise<number> {
  const rows = await q<any>(
    `SELECT 'course' AS src, i.id, i.title, i.due_on AS due, c.title AS ctx
       FROM course_items i JOIN courses c ON c.id=i.course_id
      WHERE i.owner_id=$1 AND NOT i.done AND i.due_on IS NOT NULL
        AND i.due_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
     UNION ALL
     SELECT 'chapter', ch.id, ch.title, ch.due_on, 'dissertation'
       FROM dissertation_chapters ch
      WHERE ch.owner_id=$1 AND ch.status <> 'complete' AND ch.due_on IS NOT NULL
        AND ch.due_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
     UNION ALL
     SELECT 'revision', s.id, s.title, s.revision_due, s.venue
       FROM submissions s
      WHERE s.owner_id=$1 AND s.revision_due IS NOT NULL
        AND s.revision_due BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`,
    [ownerId]).catch(() => []);

  let made = 0;
  for (const r of rows) {
    const key = `${r.src}:${r.id}:${String(r.due).slice(0, 10)}`;
    const already = await one(
      `SELECT id FROM notifications WHERE owner_id=$1 AND kind='deadline' AND body LIKE $2`,
      [ownerId, `%${key}%`]).catch(() => null);
    if (already) continue;
    const days = Math.ceil(
      (new Date(r.due).getTime() - Date.now()) / 864e5);
    await notify(ownerId, "deadline",
      `${r.title} — due in ${days} day${days === 1 ? "" : "s"}`,
      { body: `${r.ctx} · ${key}`,
        href: r.src === "course" ? "/app/calendar"
          : r.src === "chapter" ? "/app/dissertation" : "/app/pipeline" });
    made++;
  }
  return made;
}
