import { getEntityContext } from "@/lib/entity-context"
import { ValuationPage } from "@/components/valuation/ValuationPage"

export const dynamic = "force-dynamic"

export default async function ValuationPageWrapper() {
  const { entityId, selectedEntity } = await getEntityContext()
  return (
    <div className="p-6 max-w-5xl">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Business Valuation</h1>
          <p className="page-subtitle">
            {selectedEntity?.name} — indicative planning range, not a certified appraisal
          </p>
        </div>
      </div>
      <ValuationPage
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
      />
    </div>
  )
}
