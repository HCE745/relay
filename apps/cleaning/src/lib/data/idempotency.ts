import { orgDb, isUniqueViolation } from "../org-db"

// General "at most once per org" ledger (generalized from the Phase 25 exception
// -alert dedupe). A (scope, key) pair is claimed exactly once; claimOnce returns
// true the FIRST time and false forever after, so any at-most-once action —
// exception alerts, escalation steps, a QR/SMS intake that must not double-file —
// shares one primitive instead of reinventing a dedupe table.
export async function claimOnce(orgId: string, scope: string, key: string): Promise<boolean> {
  try {
    await orgDb(orgId).idempotencyClaim.create({ data: { organizationId: orgId, scope, key } })
    return true
  } catch (e) {
    if (isUniqueViolation(e)) return false
    throw e
  }
}
