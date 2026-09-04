import { getEntityContext } from "@/lib/entity-context"
import { KPIDashboard } from "@/components/kpis/KPIDashboard"

export const dynamic = "force-dynamic"

export default async function KPIsPage() {
  const { entityId, entities } = await getEntityContext()

  const entityList = entities.map((e) => ({
    id: e.id,
    name: e.name,
    isConsolidationParent: e.isConsolidationParent,
  }))

  return <KPIDashboard entityId={entityId} entities={entityList} />
}
