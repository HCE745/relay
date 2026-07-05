import { getEntityContext } from "@/lib/entity-context"
import { ScenarioPage } from "@/components/scenarios/ScenarioPage"

export const dynamic = "force-dynamic"

export default async function ScenariosPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scenario Modeling</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Model the financial impact of a business decision using your real numbers.{" "}
          {selectedEntity && <span className="font-medium text-gray-700">{selectedEntity.name}</span>}
        </p>
      </div>
      <ScenarioPage entityId={entityId} />
    </div>
  )
}
