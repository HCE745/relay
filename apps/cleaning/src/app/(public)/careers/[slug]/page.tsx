import Link from "next/link"
import { notFound } from "next/navigation"
import { orgHasCapability } from "@/lib/page-guards"
import { getPublicCareersOrg, listPublicPostings } from "@/lib/data/hiring"

export const dynamic = "force-dynamic"

// Public careers page for one org (Phase 38). No login. Indexable; links to one
// detail page per posting. Free distribution — no board partnership needed.
export default async function PublicJobsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await getPublicCareersOrg(slug)
  if (!org || !(await orgHasCapability(org.id, "workforce.hiring"))) notFound()
  const postings = await listPublicPostings(org.id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-sm text-slate-500">{org.name}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Open positions</h1>
      </div>
      {postings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">No open positions right now. Please check back soon.</div>
      ) : (
        <ul className="space-y-3">
          {postings.map((p) => (
            <li key={p.id}>
              <Link href={`/careers/${slug}/${p.id}`} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md">
                <div className="font-semibold text-slate-900">{p.title}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-500">
                  {p.employmentType ? <span>{p.employmentType}</span> : null}
                  {p.locations ? <span>{p.locations}</span> : null}
                  {p.payRange ? <span>{p.payRange}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
