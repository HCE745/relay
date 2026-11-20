import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canAccessAdminRoute } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getReport, reportHistory } from "@/lib/data/employee-reports"
import { listUsers } from "@/lib/data/users"
import {
  canInvestigate,
  canBeReviewer,
  type ActorRole,
  type Confidentiality,
} from "@/lib/employee-reports/access"
import { InvestigationPanel } from "@/components/reports/investigation-panel"

export const dynamic = "force-dynamic"

export default async function EmployeeReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canAccessAdminRoute(session.role, "employee-reports")) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, "operations.employeeReports"))) redirect("/dashboard")

  const { id } = await params
  const orgId = session.organizationId
  const actor = { userId: session.userId, role: session.role as ActorRole }

  let report: Awaited<ReturnType<typeof getReport>>
  try {
    report = await getReport(orgId, actor, id)
  } catch {
    notFound() // forbidden or missing → indistinguishable 404 (never confirm existence)
  }
  report = report!
  const ref = { reportedById: report.reportedById, aboutUserId: report.aboutUserId, confidentiality: report.confidentiality as Confidentiality }
  const mayInvestigate = canInvestigate(actor, ref).allowed

  const [users, history] = await Promise.all([
    listUsers(orgId),
    reportHistory(orgId, actor, id).catch(() => []),
  ])
  const activeUsers = users.filter((u) => u.isActive && u.role !== "CLIENT")
  const reviewers = activeUsers
    .filter((u) => canBeReviewer({ role: u.role as ActorRole, userId: u.id }, ref))
    .map((u) => ({ id: u.id, name: u.name }))
  const assignees = activeUsers.map((u) => ({ id: u.id, name: u.name }))

  const dto = {
    id: report.id,
    category: report.category,
    confidentiality: report.confidentiality,
    status: report.status,
    outcome: report.outcome,
    title: report.title,
    description: report.description,
    subjectName: report.about?.name ?? null,
    reporterName: report.reportedBy?.name ?? null,
    reviewerName: report.reviewer?.name ?? null,
    reviewerId: report.reviewerId,
    finding: report.finding,
    employeeResponse: report.employeeResponse,
    correctiveAction: report.correctiveAction,
    correctiveAssigneeName: report.correctiveAssignee?.name ?? null,
    correctiveDueAt: report.correctiveDueAt ? report.correctiveDueAt.toISOString() : null,
    jobId: report.jobId,
    jobTitle: report.job?.title ?? null,
    checklistLabel: report.checklistItem?.label ?? null,
    createdAt: report.createdAt.toISOString(),
    photos: report.photos.map((p) => ({ id: p.id })),
  }
  const historyDto = history.map((h) => ({
    id: h.id,
    action: h.action,
    createdAt: h.createdAt.toISOString(),
    oldValue: h.oldValue,
    newValue: h.newValue,
  }))

  return (
    <div className="space-y-5">
      <Link href="/reports/employee" className="text-sm text-slate-500 hover:text-brand">
        ← Workplace reports
      </Link>
      <InvestigationPanel
        report={dto}
        history={historyDto}
        canInvestigate={mayInvestigate}
        reviewers={reviewers}
        assignees={assignees}
      />
    </div>
  )
}
