import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getTrialBalance, getPL, getBalanceSheet, getARAgingReport, getAPAgingReport, toCsv, centsToDisplay } from "@/lib/reports"
import { ReportViewer } from "@/components/reports/ReportViewer"

export const dynamic = "force-dynamic"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string; consolidated?: string }>
}) {
  const { tenantId, entityId, selectedEntity } = await getEntityContext()
  const { report = "pl", from, to, consolidated } = await searchParams

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1)
  const defaultTo = new Date(now.getFullYear(), 11, 31)

  const startDate = from ? new Date(from) : defaultFrom
  const endDate = to ? new Date(to) : defaultTo
  const isConsolidated = consolidated === "true" && selectedEntity?.isConsolidationParent

  const period = { start: startDate, end: endDate }

  type ReportData = {
    type: string
    data: unknown
    period: { start: string; end: string }
    entity: string
    consolidated: boolean
  }

  let reportData: ReportData | null = null

  if (report === "pl") {
    const data = await getPL(tenantId, entityId, period, { consolidated: isConsolidated })
    reportData = { type: "pl", data, period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }, entity: selectedEntity?.name ?? "", consolidated: isConsolidated }
  } else if (report === "bs") {
    const data = await getBalanceSheet(tenantId, entityId, endDate, { consolidated: isConsolidated })
    reportData = { type: "bs", data, period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }, entity: selectedEntity?.name ?? "", consolidated: isConsolidated }
  } else if (report === "tb") {
    const data = await getTrialBalance(tenantId, entityId, period)
    reportData = { type: "tb", data, period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }, entity: selectedEntity?.name ?? "", consolidated: false }
  } else if (report === "ar_aging") {
    const data = await getARAgingReport(tenantId, entityId, now)
    reportData = { type: "ar_aging", data, period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }, entity: selectedEntity?.name ?? "", consolidated: false }
  } else if (report === "ap_aging") {
    const data = await getAPAgingReport(tenantId, entityId, now)
    reportData = { type: "ap_aging", data, period: { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }, entity: selectedEntity?.name ?? "", consolidated: false }
  }

  const isParent = selectedEntity?.isConsolidationParent ?? false

  return (
    <ReportViewer
      reportData={reportData}
      isConsolidationParent={isParent}
      selectedReport={report}
    />
  )
}
