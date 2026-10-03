import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getEstimate } from "@/lib/data/estimates"
import { listProductionRates } from "@/lib/data/production-rates"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState } from "@/components/ui/controls"
import { ChartBarIcon } from "@/components/ui/icons"
import { BidWorksheet } from "@/components/estimates/bid-worksheet"
import { SeedRatesButton } from "@/components/estimates/seed-rates-button"

export const dynamic = "force-dynamic"
const CAP = "crm.bidCalculator"

type SavedBid = { inputs?: { areas?: unknown[]; laborRate?: unknown; suppliesPct?: unknown; overheadPct?: unknown; targetMarginPct?: unknown } }

export default async function BidPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Bid calculator" /><UpgradeNotice capability={CAP} /></div>)
  }

  const { id } = await params
  const [est, rates] = await Promise.all([getEstimate(orgId, id), listProductionRates(orgId, { activeOnly: true })])
  if (!est) notFound()

  const rateProps = rates.map((r) => ({ id: r.id, taskType: r.taskType, surfaceType: r.surfaceType, sqftPerHour: r.sqftPerHour.toString() }))
  const saved = (est.bidWorksheet as SavedBid | null)?.inputs
  const initial = saved
    ? {
        areas: (saved.areas as { name: string; sqft: number | string; surfaceType: string; sqftPerHour: number | string; frequency: string }[]).map((a) => ({
          name: a.name, sqft: String(a.sqft), surfaceType: a.surfaceType, sqftPerHour: String(a.sqftPerHour), frequency: a.frequency,
        })),
        laborRate: String(saved.laborRate ?? ""),
        suppliesPct: String(saved.suppliesPct ?? ""),
        overheadPct: String(saved.overheadPct ?? ""),
        targetMarginPct: String(saved.targetMarginPct ?? ""),
      }
    : undefined

  return (
    <div>
      <Link href={`/estimates/${est.id}`} className="mb-4 inline-block text-sm text-slate-500 hover:text-brand">← {est.title}</Link>
      <PageHeader title="Bid calculator" subtitle="Price from production rates — labor, supplies, overhead, margin" icon={<ChartBarIcon />} />

      {est.convertedCustomerId ? (
        <Card className="p-5 text-sm text-slate-600">This estimate is converted and read-only.</Card>
      ) : rates.length === 0 ? (
        <EmptyState
          icon={<ChartBarIcon />}
          title="No production rates yet"
          description="The bid calculator prices work from a library of production rates (sq ft per hour). Seed the industry-standard defaults to get started — you can tune them anytime."
          action={<SeedRatesButton />}
        />
      ) : (
        <BidWorksheet estimateId={est.id} rates={rateProps} initial={initial} />
      )}
    </div>
  )
}
