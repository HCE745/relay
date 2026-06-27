/**
 * Entity context helpers for server components.
 * Entity selection is stored in a cookie ("hce-entity").
 */
import "server-only"
import { cookies } from "next/headers"
import { prisma } from "./prisma"
import { requireSession } from "./session"

export async function getSelectedEntityId(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? "hce-entity"
}

export async function getEntityContext() {
  const session = await requireSession()
  const entityId = await getSelectedEntityId()

  const entities = await prisma.entity.findMany({
    where: { tenantId: session.tenantId, id: { in: session.entityIds } },
    orderBy: { name: "asc" },
  })

  const selectedEntity = entities.find((e) => e.id === entityId) ?? entities[0]

  return {
    session,
    entities,
    selectedEntity,
    tenantId: session.tenantId,
    entityId: selectedEntity?.id ?? entityId,
  }
}
