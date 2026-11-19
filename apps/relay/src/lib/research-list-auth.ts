import "server-only"
import { getSession } from "@/lib/session"
import { getSalesSession } from "@/lib/sales-auth"

export type ListOwnerRecord = {
  salesUserId:  string | null
  superAdminId: string | null
}

export type ListAuthSession = {
  salesUserId?:  string | null
  superAdminId?: string | null
}

/**
 * Effective CRM research identity for the current request.
 *
 * During a valid, unexpired CRM impersonation session the identity resolves to
 * the impersonated rep — superAdminId is null, salesUserId is the rep's id.
 * Outside impersonation a super-admin resolves to their own superAdminId.
 * Returns null for unauthenticated or inactive users.
 */
export interface ResearchIdentity {
  superAdminId:       string | null  // non-null for SA outside impersonation only
  salesUserId:        string | null  // non-null for reps and during active impersonation
  isCrmImpersonation: boolean
}

export async function getResearchIdentity(): Promise<ResearchIdentity | null> {
  const [info, session] = await Promise.all([getSalesSession(), getSession()])
  if (!info || !session) return null

  if (info.isCrmImpersonation) {
    return {
      superAdminId:       null,
      salesUserId:        info.salesUserId,
      isCrmImpersonation: true,
    }
  }

  if (info.isSuperAdmin) {
    return {
      superAdminId:       session.superAdminId ?? null,
      salesUserId:        null,
      isCrmImpersonation: false,
    }
  }

  return {
    superAdminId:       null,
    salesUserId:        session.salesUserId ?? null,
    isCrmImpersonation: false,
  }
}

/**
 * Returns true if `session` owns this list.
 *
 * Ownership is the only access criterion. `isShared` is a display/metadata
 * flag and does NOT grant access to users other than the owner.
 */
export function listIsOwner(list: ListOwnerRecord, session: ListAuthSession): boolean {
  if (session.superAdminId && list.superAdminId === session.superAdminId) return true
  if (session.salesUserId  && list.salesUserId  === session.salesUserId)  return true
  return false
}
