import "server-only"
import { getSession, type SessionPayload } from "./session"
import { canManageAccounts } from "./rbac"
import { orgHasCapability } from "./page-guards"
import { unauthorized, forbidden } from "./api"

export type Guarded =
  | { ok: true; session: SessionPayload; orgId: string }
  | { ok: false; response: Response }

/**
 * Guard for customer-account administration routes: requires a session, an
 * account-management role, and (optionally) a capability. Returns the session
 * and orgId, or a ready-to-return error Response.
 */
export async function requireAccountManager(requiredCap?: string): Promise<Guarded> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (!canManageAccounts(session.role)) return { ok: false, response: forbidden() }
  if (requiredCap && !(await orgHasCapability(session.organizationId, requiredCap))) {
    return { ok: false, response: forbidden(`Missing capability: ${requiredCap}`) }
  }
  return { ok: true, session, orgId: session.organizationId }
}
