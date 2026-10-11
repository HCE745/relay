import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getSatisfactionReport } from "@/lib/data/surveys"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"

export const dynamic = "force-dynamic"
const CAP = "quality.inspections"

function Table({ title, rows }: { title: string; rows: { id: string; name: string; count: number; avg: number }[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No ratings yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-slate-400"><th className="py-1 text-left">Name</th><th className="py-1 text-right">Avg</th><th className="py-1 text-right">Ratings</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}><td className="py-1.5 text-slate-800">{r.name}</td><td className="py-1.5 text-right font-medium text-slate-900">{r.avg.toFixed(2)} ★</td><td className="py-1.5 text-right text-slate-500">{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export default async function SatisfactionPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Satisfaction" /><UpgradeNotice capability={CAP} /></div>)
  }
  const report = await getSatisfactionReport(orgId)

  return (
    <div className="space-y-6">
      <PageHeader title="Customer satisfaction" subtitle={report.overall != null ? `Overall ${report.overall.toFixed(2)} ★ across ${report.count} ratings` : "No ratings yet"} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Table title="By site" rows={report.bySite} />
        <Table title="By cleaner" rows={report.byCleaner} />
      </div>
    </div>
  )
}
