import { systemDb } from "@/lib/org-db"
import { orgHasCapability } from "@/lib/page-guards"
import { listJobPostings } from "@/lib/data/hiring"
import { ApplyForm } from "@/components/hiring/apply-form"

export const dynamic = "force-dynamic"

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await systemDb.organization.findUnique({ where: { slug }, select: { id: true, name: true } })
  const available = org ? await orgHasCapability(org.id, "workforce.hiring") : false
  const postings = org && available ? (await listJobPostings(org.id)).filter((p) => p.status === "OPEN") : []

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {!org || !available ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">Applications unavailable</p>
          <p className="mt-1 text-sm text-slate-500">This page isn&apos;t accepting online applications right now.</p>
        </div>
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">Join {org.name}</h1>
          <p className="mx-auto mt-1 mb-6 max-w-sm text-center text-sm text-slate-500">Apply below and our hiring team will be in touch.</p>
          <ApplyForm slug={slug} orgName={org.name} postings={postings.map((p) => ({ id: p.id, title: p.title }))} />
        </>
      )}
    </div>
  )
}
