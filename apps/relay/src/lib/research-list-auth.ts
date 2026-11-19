import "server-only"

export type ListOwnerRecord = {
  salesUserId:  string | null
  superAdminId: string | null
}

export type ListAuthSession = {
  salesUserId?:  string | null
  superAdminId?: string | null
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
