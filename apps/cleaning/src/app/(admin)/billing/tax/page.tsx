import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listTaxRates, listSiteTaxability } from "@/lib/data/tax-rates"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { TaxSettings } from "@/components/billing/tax-settings"

export const dynamic = "force-dynamic"
const CAP = "billing.salesTax"

export default async function SalesTaxPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Sales tax" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [rates, sites] = await Promise.all([
    listTaxRates(session.organizationId),
    listSiteTaxability(session.organizationId),
  ])

  return (
    <div>
      <PageHeader title="Sales tax" subtitle="Configure jurisdiction rates and which sites are taxable" />
      <div className="mt-6">
        <TaxSettings
          rates={rates.map((r) => ({
            id: r.id, name: r.name, jurisdiction: r.jurisdiction, ratePct: r.ratePct,
            isActive: r.isActive, effectiveDate: r.effectiveDate.toISOString(),
          }))}
          sites={sites}
        />
      </div>
    </div>
  )
}
