import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getLead } from "@/lib/data/leads"
import { listUsers } from "@/lib/data/users"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { LeadRowActions } from "@/components/leads/lead-dialogs"

export const dynamic = "force-dynamic"
const CAP = "crm.estimates"

const TONE: Record<string, BadgeTone> = { NEW: "info", CONTACTED: "brand", ESTIMATING: "warning", WON: "success", LOST: "neutral" }
const EST_TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SENT: "info", ACCEPTED: "success", DECLINED: "danger", CONVERTED: "success", EXPIRED: "neutral" }
const titleize = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) redirect("/dashboard")

  const { id } = await params
  const lead = await getLead(session.organizationId, id)
  if (!lead) notFound()
  const users = await listUsers(session.organizationId)
  const assignees = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-slate-500 hover:text-brand">← Leads</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <PageHeader title={lead.company || lead.name} subtitle={lead.company ? lead.name : undefined} />
          <div className="flex items-center gap-3">
            <StatusBadge tone={TONE[lead.status] ?? "neutral"}>{titleize(lead.status)}</StatusBadge>
            <LeadRowActions
              lead={{ id: lead.id, name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, source: lead.source, status: lead.status, notes: lead.notes, assignedToId: lead.assignedToId }}
              assignees={assignees}
            />
          </div>
        </div>
      </div>

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Detail label="Contact" value={lead.name} />
        <Detail label="Company" value={lead.company || "—"} />
        <Detail label="Email" value={lead.email || "—"} />
        <Detail label="Phone" value={lead.phone || "—"} />
        <Detail label="Source" value={lead.source || "—"} />
        <Detail label="Assigned to" value={lead.assignedTo?.name || "Unassigned"} />
        {lead.notes ? <div className="sm:col-span-2"><Detail label="Notes" value={lead.notes} /></div> : null}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Estimates ({lead.estimates.length})</h2>
        {lead.estimates.length === 0 ? (
          <p className="text-sm text-slate-500">No estimates yet. Create one from <Link href="/estimates/new" className="text-brand hover:underline">Estimates</Link>.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lead.estimates.map((e) => (
              <li key={e.id} className="py-2.5">
                <Link href={`/estimates/${e.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-brand">
                  <span className="min-w-0 truncate font-medium text-slate-900">{e.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">{fmtDate(e.createdAt)}<StatusBadge tone={EST_TONE[e.status] ?? "neutral"}>{titleize(e.status)}</StatusBadge></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
    </div>
  )
}
