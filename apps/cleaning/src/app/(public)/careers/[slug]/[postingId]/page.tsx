import Link from "next/link"
import { notFound } from "next/navigation"
import { orgHasCapability } from "@/lib/page-guards"
import { getPublicCareersOrg, getPublicPosting } from "@/lib/data/hiring"
import { jobPostingJsonLd } from "@/lib/job-posting-jsonld"
import { ApplyForm } from "@/components/hiring/apply-form"

export const dynamic = "force-dynamic"

// One posting = one public detail page carrying Google for Jobs JSON-LD, with
// the application form inline. A closed/missing posting 404s so the markup is
// removed when the role closes (Google requires expired jobs to be taken down).
export default async function PublicPostingPage({ params, searchParams }: { params: Promise<{ slug: string; postingId: string }>; searchParams: Promise<{ src?: string }> }) {
  const { slug, postingId } = await params
  const { src } = await searchParams
  const org = await getPublicCareersOrg(slug)
  if (!org || !(await orgHasCapability(org.id, "workforce.hiring"))) notFound()
  const posting = await getPublicPosting(org.id, postingId)
  if (!posting) notFound()

  const jsonLd = jobPostingJsonLd(posting, org.name)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Google for Jobs structured data. Matches the visible content below. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-4">
        <Link href={`/careers/${slug}`} className="text-sm text-slate-500 hover:text-brand">← All openings</Link>
      </div>
      <p className="text-sm text-slate-500">{org.name}</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{posting.title}</h1>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-500">
        {posting.employmentType ? <span>{posting.employmentType}</span> : null}
        {posting.locations ? <span>{posting.locations}</span> : null}
        {posting.payRange ? <span>{posting.payRange}</span> : null}
      </div>

      {posting.description ? (
        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{posting.description}</div>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Apply</h2>
        <ApplyForm slug={slug} orgName={org.name} postings={[]} fixedPostingId={posting.id} source={src} />
      </div>
    </div>
  )
}
