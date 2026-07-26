import { getEntityContext } from "@/lib/entity-context"
import { ScenarioPage } from "@/components/scenarios/ScenarioPage"

export const dynamic = "force-dynamic"

export default async function ScenariosPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()

  return (
    <div className="p-6 max-w-5xl">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Scenario Modeling</h1>
          <p className="page-subtitle">
            Model the financial impact of a business decision using your real numbers
            {selectedEntity && <> · <span className="font-medium">{selectedEntity.name}</span></>}
          </p>
        </div>
      </div>
      <ScenarioPage entityId={entityId} />
    </div>
  )
}
