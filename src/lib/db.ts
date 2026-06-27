import "server-only"
import { prisma } from "./prisma"

export async function writeAuditLog(params: {
  tenantId: string
  entityId?: string | null
  userId?: string | null
  action: string
  tableName: string
  recordId: string
  before?: unknown
  after?: unknown
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      entityId: params.entityId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      tableName: params.tableName,
      recordId: params.recordId,
      beforeJson: (params.before ?? null) as never,
      afterJson: (params.after ?? null) as never,
    },
  })
}
