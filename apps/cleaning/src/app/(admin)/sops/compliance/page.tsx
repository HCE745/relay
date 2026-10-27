import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canViewSchedule } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { complianceSummary } from "@/lib/data/sops"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")

export default async function SopCompliancePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="SOP compliance" /><UpgradeNotice capability={CAP} /></div>)
  }
  const rows = await complianceSummary(orgId)

  return (
    <div className="space-y-5">
      <div><Link href="/sops" className="text-sm text-slate-500 hover:text-brand">← SOPs</Link></div>
      <PageHeader title="Acknowledgment compliance" subtitle="Who has acknowledged what, and who is outstanding." />
      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">No SOPs require acknowledgment yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">SOP</th><th className="px-4 py-2.5 font-medium">Category</th><th className="px-4 py-2.5 font-medium">Current</th><th className="px-4 py-2.5 font-medium">Outstanding</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link href={`/sops/${r.id}`} className="font-medium text-slate-900 hover:text-brand">{r.title}</Link></td>
                  <td className="px-4 py-3 text-slate-600">{titleize(r.category)}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-700">{r.current}/{r.total}</td>
                  <td className="px-4 py-3 tabular-nums">{r.outstanding > 0 ? <span className="font-semibold text-red-600">{r.outstanding}</span> : <span className="text-slate-400">0</span>}</td>
                  <td className="px-4 py-3 text-right"><a href={`/api/sops/${r.id}/compliance/export`} className="text-sm font-medium text-brand hover:underline">CSV</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
