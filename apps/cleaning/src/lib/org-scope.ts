// Organization-scoped data access.
//
// Every tenant-scoped query must be constrained to the caller's organization.
// Relay does this by hand (`where: { organizationId }`) in ~184 places, which
// is easy to forget. These helpers make the org filter explicit and make it
// impossible for a caller-supplied `organizationId` to widen the scope — the
// authoritative orgId is always applied LAST and therefore always wins.

export type WhereLike = Record<string, unknown>

/** Merge a where-clause with the org filter; the authoritative orgId wins. */
export function scopeWhere<T extends WhereLike>(orgId: string, where?: T): T & { organizationId: string } {
  return { ...(where ?? ({} as T)), organizationId: orgId }
}

/** Merge create-data with the org filter; the authoritative orgId wins. */
export function scopeCreate<T extends WhereLike>(orgId: string, data: T): T & { organizationId: string } {
  return { ...data, organizationId: orgId }
}

/**
 * Guard a record fetched by id: returns it only if it belongs to the org,
 * otherwise null (treat as not-found). Prevents cross-org id enumeration.
 */
export function assertOrg<T extends { organizationId: string } | null | undefined>(
  orgId: string,
  record: T,
): T | null {
  if (!record) return null
  return record.organizationId === orgId ? record : null
}

/** Convenience: bind an orgId once and reuse the builders. */
export function forOrg(orgId: string) {
  return {
    orgId,
    where: <T extends WhereLike>(where?: T) => scopeWhere(orgId, where),
    create: <T extends WhereLike>(data: T) => scopeCreate(orgId, data),
    assert: <T extends { organizationId: string } | null | undefined>(record: T) =>
      assertOrg(orgId, record),
  }
}
