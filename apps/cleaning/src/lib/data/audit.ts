import { orgDb } from "../org-db"

// Thin wrapper over AuditEvent for material supervisory actions (corrections,
// approvals, inspection finalization, manual MISSED). Actor comes from the
// session. We deliberately do NOT log routine UI activity.
export function recordAudit(
  orgId: string,
  actorUserId: string,
  entityType: string,
  entityId: string,
  action: string,
  opts: { field?: string; oldValue?: string; newValue?: string; metadata?: unknown } = {},
) {
  return orgDb(orgId).auditEvent.create({
    data: {
      organizationId: orgId,
      actorUserId,
      entityType,
      entityId,
      action,
      field: opts.field,
      oldValue: opts.oldValue,
      newValue: opts.newValue,
      metadata: opts.metadata === undefined ? undefined : (opts.metadata as object),
    },
  })
}

export function listAuditForEntity(orgId: string, entityType: string, entityId: string) {
  return orgDb(orgId).auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  })
}
