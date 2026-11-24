import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getWorkOrder } from "@/lib/data/work-orders"
import { PageHeader } from "@/components/ui/placeholder"
import { Card, StatusBadge } from "@/components/ui/controls"
import { BriefcaseIcon } from "@/components/ui/icons"

export const dynamic = "force-dynamic"
const CAP = "operations.workOrders"
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")
const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) redirect("/dashboard")
  const { id } = await params
  const wo = await getWorkOrder(session.organizationId, id)
  if (!wo) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/work-orders" className="text-sm text-slate-500 hover:text-brand">← Work orders</Link>
      <PageHeader
        title={title(wo.type)}
        subtitle={wo.description}
        icon={<BriefcaseIcon />}
        action={<div className="flex items-center gap-2">{wo.isCorrective ? <StatusBadge tone="purple">Corrective</StatusBadge> : null}<StatusBadge tone="info">{title(wo.status)}</StatusBadge></div>}
      />

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Detail label="Priority" value={title(wo.priority)} />
        <Detail label="Billable" value={wo.billable ? "Yes" : "No (corrective)"} />
        <Detail label="Quoted" value={wo.quotedAmount ? `$${wo.quotedAmount.toFixed(2)}` : "—"} />
        <Detail label="Due" value={fmtDate(wo.dueAt)} />
        {wo.requestedBy ? <Detail label="Requested by" value={wo.requestedBy} /> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Related records</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <LinkRow label="Customer" href={`/customers/${wo.customer.id}`} value={wo.customer.name} />
          {wo.serviceLocation ? <LinkRow label="Service location" href="/locations" value={wo.serviceLocation.name} /> : <Detail label="Service location" value="—" />}
          {wo.issue ? <LinkRow label="Originating issue" href={`/issues/${wo.issue.id}`} value={wo.issue.title || wo.issue.description.slice(0, 40)} /> : null}
          {wo.inspection ? <LinkRow label="Inspection" href={`/inspections/${wo.inspection.id}`} value="View inspection" /> : null}
          {wo.convertedJob ? <LinkRow label="Scheduled job" href={`/jobs/${wo.convertedJob.id}`} value={wo.convertedJob.title} /> : null}
          {wo.assignedTo ? <LinkRow label="Assigned to" href="/team" value={wo.assignedTo.name} /> : <Detail label="Assigned to" value="Unassigned" />}
        </div>
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value}</dd></div>
}
function LinkRow({ label, href, value }: { label: string; href: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <Link href={href} className="text-sm font-medium text-brand-700 hover:text-brand-800">{value} →</Link>
    </div>
  )
}
