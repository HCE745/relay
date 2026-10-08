import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { orgHasCapability } from "@/lib/page-guards"
import { listJobPostings, listApplicants } from "@/lib/data/hiring"
import { listUsers } from "@/lib/data/users"
import { systemDb } from "@/lib/org-db"
import { PageHeader, UpgradeNotice } from "@/components/ui/placeholder"
import { UsersIcon } from "@/components/ui/icons"
import { HiringClient, NewPostingButton } from "@/components/hiring/hiring-client"

export const dynamic = "force-dynamic"
const CAP = "workforce.hiring"

export default async function HiringPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canManageAccounts(session.role)) redirect("/dashboard")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return (<div><PageHeader title="Hiring" /><UpgradeNotice capability={CAP} /></div>)
  }

  const [postings, applicants, users, org] = await Promise.all([
    listJobPostings(orgId),
    listApplicants(orgId),
    listUsers(orgId),
    systemDb.organization.findUnique({ where: { id: orgId }, select: { slug: true } }),
  ])
  const applyPath = org ? `/apply/${org.slug}` : null

  return (
    <div>
      <PageHeader
        title="Hiring"
        subtitle="Job postings and applicant pipeline"
        icon={<UsersIcon />}
        action={<NewPostingButton />}
      />
      {applyPath ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="text-slate-500">Public application page:</span>
          <Link href={applyPath} target="_blank" className="font-medium text-brand hover:underline">{applyPath}</Link>
          <span className="text-xs text-slate-400">— share this link for online applications</span>
        </div>
      ) : null}
      <HiringClient
        postings={postings.map((p) => ({
          id: p.id, title: p.title, status: p.status, employmentType: p.employmentType, payRange: p.payRange,
          locations: p.locations, applicantCount: p._count.applicants,
        }))}
        applicants={applicants.map((a) => ({
          id: a.id, name: a.name, email: a.email, phone: a.phone, status: a.status,
          appliedFor: a.appliedFor ?? a.jobPosting?.title ?? null, convertedUserId: a.convertedUserId,
          interviews: a.interviews.map((i) => ({ id: i.id, date: i.date.toISOString(), outcomeNotes: i.outcomeNotes })),
        }))}
        members={users.map((u) => ({ id: u.id, name: u.name }))}
      />
    </div>
  )
}
