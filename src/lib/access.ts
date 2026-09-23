import "server-only";
import { one, q } from "./db";

// Who may read the full text of a published piece.
//
// One module decides this, and every read path asks it. A second opinion
// living in a page component is how work leaks: the rule would then be
// whichever copy someone remembered to update.

export type ReaderAccess = "public" | "full" | "abstract";
export type AccessStatus = "pending" | "approved" | "declined" | "revoked";

export type AccessVerdict = {
  /** May the viewer read the body? */
  canReadFull: boolean;
  /** The author's setting for this piece. */
  policy: ReaderAccess;
  /** This viewer's standing, if they have one. */
  status: AccessStatus | null;
  /** Viewer is the author. */
  isOwner: boolean;
  /** Show a "request access" control. */
  canRequest: boolean;
};

export function normalizePolicy(v: unknown): ReaderAccess {
  return v === "full" || v === "abstract" ? v : "public";
}

export async function accessFor(
  pub: { id: number; owner_id: number; reader_access?: string | null },
  viewerId: number | null,
): Promise<AccessVerdict> {
  const policy = normalizePolicy(pub.reader_access);
  const isOwner = viewerId != null && viewerId === pub.owner_id;

  if (isOwner) {
    return { canReadFull: true, policy, status: "approved", isOwner: true, canRequest: false };
  }
  if (policy === "public") {
    return { canReadFull: true, policy, status: null, isOwner: false, canRequest: false };
  }
  // Signed out: there is a gate, and they cannot be on the other side of it yet.
  if (viewerId == null) {
    return { canReadFull: false, policy, status: null, isOwner: false, canRequest: false };
  }

  const row = await one<{ status: AccessStatus }>(
    `SELECT status FROM document_access WHERE publication_id=$1 AND reader_id=$2`,
    [pub.id, viewerId],
  ).catch(() => null);

  const status = row?.status ?? null;
  return {
    canReadFull: status === "approved",
    policy,
    status,
    isOwner: false,
    // Declined and revoked do not get a second bite. Asking again after the
    // author said no turns a decision into a negotiation.
    canRequest: status === null,
  };
}

/**
 * The cohort around a document: everyone approved to read it, plus the author.
 * Members can see each other — that is what makes it a cohort rather than a
 * list of individual permissions.
 */
export async function cohortFor(publicationId: number) {
  return q<any>(
    `SELECT u.id, u.name, u.email, p.handle, p.display_name, p.avatar_url, da.decided_at
       FROM document_access da
       JOIN users u ON u.id = da.reader_id
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE da.publication_id = $1 AND da.status = 'approved'
      ORDER BY da.decided_at NULLS LAST, u.id`,
    [publicationId],
  ).catch(() => []);
}
