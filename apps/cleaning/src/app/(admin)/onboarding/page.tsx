import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { orgDb } from "@/lib/org-db"
import { listPackets, listAssignments } from "@/lib/data/onboarding"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card, StatusBadge } from "@/components/ui/controls"
import { OnboardingManager } from "@/components/onboarding/onboarding-client"

export const dynamic = "force-dynamic"
const CAP = "workforce.hiring"

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Onboarding" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const [packets, assignments, employees] = await Promise.all([
    listPackets(session.organizationId),
    listAssignments(session.organizationId),
    orgDb(session.organizationId).user.findMany({
      where: { isActive: true, role: { in: ["CLEANER", "SUPERVISOR", "MANAGER"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="space-y-8">
      <PageHeader title="Onboarding" subtitle="Document checklists assigned to employees, tracked to completion" />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">In progress & completed</h2>
        {assignments.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">No packets assigned yet. Create one below and assign it, or flag it to auto-assign on hire.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 font-medium">Packet</th>
                  <th className="px-4 py-2.5 font-medium">Progress</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.userName}</td>
                    <td className="px-4 py-3 text-slate-600">{a.packetName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-brand" style={{ width: `${a.total === 0 ? 100 : Math.round((a.done / a.total) * 100)}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-slate-500">
                          {a.done}/{a.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.completedAt ? <StatusBadge tone="success">Complete</StatusBadge> : <StatusBadge tone="warning">In progress</StatusBadge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/onboarding/${a.id}`} className="text-sm font-medium text-brand hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Packets</h2>
        <OnboardingManager packets={packets} employees={employees} />
      </div>
    </div>
  )
}
