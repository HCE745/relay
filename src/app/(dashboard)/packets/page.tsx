import { getEntityContext } from "@/lib/entity-context"
import { PacketsPage } from "@/components/packets/PacketsPage"

export const dynamic = "force-dynamic"

export default async function PacketsPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()
  return (
    <div className="p-6 max-w-6xl">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Report Packets</h1>
          <p className="page-subtitle">
            {selectedEntity?.name} — generate, preview, and export structured financial packets
          </p>
        </div>
      </div>
      <PacketsPage
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
