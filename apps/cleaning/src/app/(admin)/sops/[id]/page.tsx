import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canViewSchedule, canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getSopForEdit, getSopVersion, complianceForSop } from "@/lib/data/sops"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { SopReader } from "@/components/sops/sop-reader"
import { SopAdminActions } from "@/components/sops/sop-admin-actions"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")
const fmt = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const ACK_TONE: Record<string, BadgeTone> = { current: "success", outdated: "warning", expired: "warning", outstanding: "danger" }

export default async function SopDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; q?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canViewSchedule(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="SOP" /><UpgradeNotice capability={CAP} /></div>)
  }
  const { id } = await params
  const { v, q } = await searchParams
  const data = await getSopForEdit(orgId, id)
  if (!data) notFound()
  const canAuthor = canManageAccounts(session.role)

  // Which version to show: ?v override, else the latest published, else the draft.
  const shown = v ? Number(v) : (data.publishedVersion ?? data.sop.currentVersion)
  const version = await getSopVersion(orgId, id, shown)
  if (!version) notFound()
  const hasDraft = data.sop.currentVersion > (data.publishedVersion ?? 0)

  const compliance = data.sop.requiresAck ? await complianceForSop(orgId, id) : null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/sops" className="text-sm text-slate-500 hover:text-brand">← SOPs</Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <PageHeader title={data.sop.title} subtitle={`${titleize(data.sop.category)}${data.sop.requiresAck ? " · acknowledgment required" : ""}`} />
          <div className="flex items-center gap-2">
            <StatusBadge tone={data.sop.status === "PUBLISHED" ? "success" : "neutral"}>{data.sop.status}</StatusBadge>
          </div>
        </div>
      </div>

      {canAuthor ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <SopAdminActions sopId={id} hasDraft={hasDraft} isPublished={data.sop.status === "PUBLISHED"} isArchived={data.sop.status === "ARCHIVED"} />
          {hasDraft ? <span className="text-xs text-amber-600">Unpublished draft v{data.sop.currentVersion} in progress</span> : null}
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-500">
            Version {version.version}{version.publishedAt ? ` · published ${fmt(version.publishedAt)}` : " · draft"}
            {version.version !== (data.publishedVersion ?? data.sop.currentVersion) ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">historical</span> : null}
          </div>
          {data.versions.length > 1 ? (
            <div className="flex flex-wrap gap-1 text-xs">
              {data.versions.map((vr) => (
                <Link key={vr.version} href={`/sops/${id}?v=${vr.version}`} className={`rounded px-2 py-0.5 ${vr.version === shown ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>v{vr.version}{vr.publishedAt ? "" : " (draft)"}</Link>
              ))}
            </div>
          ) : null}
        </div>
        {version.attachmentUrl ? <a href={version.attachmentUrl} target="_blank" rel="noreferrer" className="mb-3 inline-block text-sm font-medium text-brand hover:underline">Attached document →</a> : null}
        <SopReader sections={version.sections.map((s) => ({ id: s.id, heading: s.heading, body: s.body }))} q={q} />
      </Card>

      {compliance ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Acknowledgment compliance</h2>
            <a href={`/api/sops/${id}/compliance/export`} className="text-sm font-medium text-brand hover:underline">Export CSV</a>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-1">Person</th><th className="py-1">Status</th><th className="py-1">Version</th><th className="py-1">When</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {compliance.rows.map((r) => (
                <tr key={r.userId}>
                  <td className="py-2 text-slate-800">{r.name} <span className="text-xs text-slate-400">{titleize(r.role)}</span></td>
                  <td className="py-2"><StatusBadge tone={ACK_TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge></td>
                  <td className="py-2 tabular-nums text-slate-500">{r.acknowledgedVersion != null ? `v${r.acknowledgedVersion}` : "—"}</td>
                  <td className="py-2 text-slate-500">{fmt(r.acknowledgedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  )
}
