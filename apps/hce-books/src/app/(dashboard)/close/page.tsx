import { getEntityContext } from "@/lib/entity-context"
import { CloseDashboard } from "@/components/close/CloseDashboard"

export const dynamic = "force-dynamic"

export default async function ClosePage() {
  const { entityId, entities } = await getEntityContext()

  return (
    <CloseDashboard
      entityId={entityId}
      entities={entities.map((e: { id: string; name: string; isConsolidationParent: boolean }) => ({
        id: e.id,
        name: e.name,
        isConsolidationParent: e.isConsolidationParent,
      }))}
    />
  )
}
