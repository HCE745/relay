import { getEntityContext } from "@/lib/entity-context"
import { ControllerDashboard } from "@/components/controller/ControllerDashboard"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { entityId, selectedEntity } = await getEntityContext()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Controller Dashboard</h1>
        {selectedEntity && (
          <p className="text-sm text-gray-500 mt-0.5">{selectedEntity.name}</p>
        )}
      </div>
      <ControllerDashboard
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
