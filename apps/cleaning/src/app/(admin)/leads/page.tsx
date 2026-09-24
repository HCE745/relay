import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listLeads } from "@/lib/data/leads"
import { listUsers } from "@/lib/data/users"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, EmptyState, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { UsersIcon } from "@/components/ui/icons"
import { NewLeadButton, LeadRowActions } from "@/components/leads/lead-dialogs"

export const dynamic = "force-dynamic"
const CAP = "crm.estimates"

const TONE: Record<string, BadgeTone> = { NEW: "info", CONTACTED: "brand", ESTIMATING: "warning", WON: "success", LOST: "neutral" }
const LABEL: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", ESTIMATING: "Estimating", WON: "Won", LOST: "Lost" }

export default async function LeadsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Leads" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [leads, users] = await Promise.all([listLeads(session.organizationId), listUsers(session.organizationId)])
  const assignees = users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }))

  return (
    <div>
      <PageHeader title="Leads" subtitle="Prospects at the front of the pipeline" action={<NewLeadButton assignees={assignees} />} />

      {leads.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No leads yet"
          description="Capture prospects here, then create an estimate for one and convert it into a customer when they accept."
          action={<NewLeadButton assignees={assignees} />}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Assigned</th>
                <th className="px-4 py-2.5 text-right font-medium">Estimates</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{l.company || l.name}</div>
                    <div className="text-xs text-slate-500">{l.company ? l.name : l.email || l.phone || ""}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone={TONE[l.status] ?? "neutral"}>{LABEL[l.status] ?? l.status}</StatusBadge></td>
                  <td className="px-4 py-3 text-slate-600">{l.source || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{l.assignedTo?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{l._count.estimates}</td>
                  <td className="px-4 py-3">
                    <LeadRowActions
                      lead={{ id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone, source: l.source, status: l.status, notes: l.notes, assignedToId: l.assignedToId }}
                      assignees={assignees}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
