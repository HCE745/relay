import { getEntityContext } from "@/lib/entity-context"
import { IntegrationsPage } from "@/components/integrations/IntegrationsPage"

export const dynamic = "force-dynamic"

export default async function IntegrationsPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()
  return (
    <div className="p-6 max-w-3xl">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="page-subtitle">
            {selectedEntity?.name} — connect external data sources and import tools
          </p>
        </div>
      </div>
      <IntegrationsPage
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
