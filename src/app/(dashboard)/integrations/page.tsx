import { getEntityContext } from "@/lib/entity-context"
import { IntegrationsPage } from "@/components/integrations/IntegrationsPage"

export const dynamic = "force-dynamic"

export default async function IntegrationsPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {selectedEntity?.name} — connect external data sources and import tools
        </p>
      </div>
      <IntegrationsPage
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
