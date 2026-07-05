import { getEntityContext } from "@/lib/entity-context"
import { ValuationPage } from "@/components/valuation/ValuationPage"

export const dynamic = "force-dynamic"

export default async function ValuationPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Business Valuation</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {selectedEntity?.name} — indicative planning range, not a certified appraisal
        </p>
      </div>
      <ValuationPage
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
