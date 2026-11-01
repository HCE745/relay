import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { getSkillMatrix } from "@/lib/data/skills"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { Card } from "@/components/ui/controls"
import { SkillsManager } from "@/components/skills/skills-manager"

export const dynamic = "force-dynamic"
const CAP = "workforce.coverage"

export default async function SkillsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  if (!(await orgHasCapability(session.organizationId, CAP))) {
    return (
      <div>
        <PageHeader title="Skills & matching" />
        <UpgradeNotice capability={CAP} />
      </div>
    )
  }

  const matrix = await getSkillMatrix(session.organizationId)
  return (
    <div className="space-y-6">
      <PageHeader title="Skills & matching" subtitle="Employee skills and site requirements that drive coverage matching" />
      <Card className="border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        When you find coverage for a shift, available cleaners are ranked by how well they match the site&apos;s required
        skills and credentials, with prior work at the site as the tiebreaker. Define skills here and assign them to
        employees and sites. Matching is deterministic — no AI.
      </Card>
      <SkillsManager matrix={matrix} />
    </div>
  )
}
