import { getEntityContext } from "@/lib/entity-context"
import { ControllerDashboard } from "@/components/controller/ControllerDashboard"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { entityId, selectedEntity } = await getEntityContext()

  return (
    <div className="p-6 max-w-7xl">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title heritage-engraved">Controller Dashboard</h1>
          {selectedEntity && (
            <p className="page-subtitle">{selectedEntity.name}</p>
          )}
        </div>
      </div>
      <ControllerDashboard
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
