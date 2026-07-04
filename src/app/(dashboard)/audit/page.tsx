import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { AuditTrail } from "@/components/audit/AuditTrail"

export const dynamic = "force-dynamic"

export default async function AuditPage() {
  const { tenantId, entityId, entities, session } = await getEntityContext()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const rawLogs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entityId,
      createdAt: { gte: thirtyDaysAgo, lte: now },
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const initialLogs = rawLogs.map((log) => ({
    id: log.id,
    tenantId: log.tenantId,
    entityId: log.entityId ?? null,
    userId: log.userId ?? null,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    beforeJson: log.beforeJson ?? null,
    afterJson: log.afterJson ?? null,
    createdAt: log.createdAt.toISOString(),
    userName: log.user?.name ?? log.user?.email ?? "System",
  }))

  return (
    <AuditTrail
      initialLogs={initialLogs}
      entityId={entityId}
      entities={entities.map((e) => ({ id: e.id, name: e.name }))}
      userId={session.userId}
    />
  )
}
