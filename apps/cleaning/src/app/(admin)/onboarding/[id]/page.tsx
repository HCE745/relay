import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getAssignment } from "@/lib/data/onboarding"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { StatusBadge } from "@/components/ui/controls"
import { OnboardingTasks } from "@/components/onboarding/onboarding-tasks"

export const dynamic = "force-dynamic"
const CAP = "workforce.hiring"

export default async function OnboardingAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params
  const assignment = await getAssignment(session.organizationId, id)
  if (!assignment) notFound()

  const done = assignment!.tasks.filter((t) => t.status === "COMPLETE").length
  const total = assignment!.tasks.length

  return (
    <div className="space-y-6">
      <Link href="/onboarding" className="text-sm text-brand hover:underline">
        ← Onboarding
      </Link>
      <PageHeader
        title={`${assignment!.user.name} — ${assignment!.packetName}`}
        subtitle={`${done} of ${total} complete`}
      />
      {assignment!.completedAt ? <StatusBadge tone="success">Completed</StatusBadge> : <StatusBadge tone="warning">In progress</StatusBadge>}
      <OnboardingTasks
        tasks={assignment!.tasks.map((t) => ({
          id: t.id,
          label: t.label,
          requiresDocument: t.requiresDocument,
          status: t.status,
          documentRef: t.documentRef,
          note: t.note,
          completedAt: t.completedAt,
        }))}
      />
    </div>
  )
}
