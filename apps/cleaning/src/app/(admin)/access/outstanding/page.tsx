import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listOutstandingCustody } from "@/lib/data/custody"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge } from "@/components/ui/controls"
import { TagIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "operations.accessControl"

function outFor(since: Date | null): string {
  if (!since) return "unknown"
  const ms = Date.now() - since.getTime()
  if (ms < 0) return "just now"
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min`
  if (h < 48) return `${h} hr`
  return `${Math.floor(h / 24)} days`
}

export default async function OutstandingPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Outstanding items" /><UpgradeNotice capability={CAP} /></div>)
  }

  const rows = await listOutstandingCustody(orgId)

  return (
    <div>
      <PageHeader title="Outstanding items" subtitle="Everything checked out and not yet returned, longest out first" icon={<TagIcon />} />
      <div className="mb-4"><Link href="/access" className="text-sm font-medium text-brand hover:underline">← Back to access &amp; keys</Link></div>
      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">Nothing is checked out. Every key and asset is accounted for.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Held by</th>
                <th className="px-4 py-2.5 font-medium">Out for</th>
                <th className="px-4 py-2.5 font-medium">Site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.kind}:${r.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{r.label}</span> <span className="text-xs text-slate-400">{r.detail}</span>
                    {r.notReturned ? <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Unrecovered</span> : null}
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone={r.kind === "ACCESS" ? "info" : "purple"}>{r.kind === "ACCESS" ? "Key / access" : "Asset"}</StatusBadge></td>
                  <td className="px-4 py-3 text-slate-700">{r.holderName}</td>
                  <td className="px-4 py-3 text-slate-700">{outFor(r.since)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.siteName ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
