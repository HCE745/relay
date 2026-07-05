import { getEntityContext } from "@/lib/entity-context"
import { PacketsPage } from "@/components/packets/PacketsPage"

export const dynamic = "force-dynamic"

export default async function PacketsPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Packets</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {selectedEntity?.name} — generate, preview, and export structured financial packets
        </p>
      </div>
      <PacketsPage
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
