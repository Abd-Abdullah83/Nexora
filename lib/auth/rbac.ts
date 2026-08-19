import { getSession, SessionPayload, UserRole } from "@/lib/auth/session";

export async function requireAuth(): Promise<SessionPayload | null> {
  const session = await getSession();
  return session;
}

// UNCHANGED from Phase 0/pre-marketplace behavior — the twoFactorVerified
// check below must keep working exactly as it does today. Per the Phase 1
// audit note, this is the one guard that must not regress.
export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "admin") return null;
  if (!session.twoFactorVerified) return null;
  return session;
}

/**
 * Generalized role check. Accepts either a single role or a list of
 * acceptable roles, so callers can write requireRole(["seller_individual",
 * "seller_business"]) instead of writing one-off seller checks everywhere.
 *
 * Pre-existing call sites that pass a single role string (e.g.
 * requireRole("customer")) continue to work unchanged.
 */
export async function requireRole(
  role: UserRole | UserRole[]
): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(session.role)) return null;
  return session;
}

/**
 * Seller-only guard. Requires the session to be either seller role AND to
 * carry a sellerId — a session with role=seller_* but no sellerId would be
 * a bug elsewhere (e.g. login not populating it), and treating that as
 * "not authorized" here, rather than throwing, is a deliberate fail-closed
 * default so a malformed session can never be mistaken for a valid one.
 *
 * Per Section 3.1 (Strict tenant isolation): callers MUST still filter
 * every query by session.sellerId themselves. This guard only confirms the
 * requester IS a seller with a known sellerId — it does not, by itself,
 * scope any query. Ownership filtering happens at the data-access layer.
 */
export async function requireSeller(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "seller_individual" && session.role !== "seller_business") {
    return null;
  }
  if (!session.sellerId) return null;
  return session;
}
