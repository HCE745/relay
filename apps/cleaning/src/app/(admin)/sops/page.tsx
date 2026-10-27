import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listSops } from "@/lib/data/sops"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { ClipboardListIcon } from "@/components/ui/icons"
import { SopSearch } from "@/components/sops/sop-search"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")
const TONE: Record<string, BadgeTone> = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "neutral" }

export default async function SopsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="SOPs" /><UpgradeNotice capability={CAP} /></div>)
  }
  const canAuthor = canManageAccounts(session.role)
  const sops = await listSops(orgId)

  return (
    <div className="space-y-5">
      <PageHeader title="Standard operating procedures" subtitle="Approved procedures, versioned and acknowledged. No AI: staff read exactly what you wrote." icon={<ClipboardListIcon />} />

      <div className="flex flex-wrap items-center gap-2">
        {canAuthor ? <Link href="/sops/new" className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">New SOP</Link> : null}
        {canAuthor ? <Link href="/sops/mappings" className="text-sm font-medium text-brand hover:underline">Issue-category mappings →</Link> : null}
        <Link href="/sops/compliance" className="text-sm font-medium text-brand hover:underline">Acknowledgment compliance →</Link>
      </div>

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Search procedures</h2>
        <SopSearch readerBase="/sops" />
      </Card>

      <Card className="overflow-x-auto">
        {sops.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No SOPs yet.{canAuthor ? " Create one to get started." : ""}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Title</th><th className="px-4 py-2.5 font-medium">Category</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Version</th><th className="px-4 py-2.5 font-medium">Ack</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sops.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link href={`/sops/${s.id}`} className="font-medium text-slate-900 hover:text-brand">{s.title}</Link></td>
                  <td className="px-4 py-3 text-slate-600">{titleize(s.category)}</td>
                  <td className="px-4 py-3"><StatusBadge tone={TONE[s.status] ?? "neutral"}>{s.status}</StatusBadge></td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">v{s.currentVersion}</td>
                  <td className="px-4 py-3 text-slate-500">{s.requiresAck ? `${s._count.acknowledgments} ack${s._count.acknowledgments === 1 ? "" : "s"}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
