import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { getPublishedSop, hasAckedCurrent } from "@/lib/data/sops"
import { SopReader } from "@/components/sops/sop-reader"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")

export default async function MySopReaderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) notFound()
  const { id } = await params
  const { q } = await searchParams
  const version = await getPublishedSop(orgId, id)
  if (!version) notFound()
  const requiresAck = version.sop.requiresAck
  const acked = requiresAck ? await hasAckedCurrent(orgId, session.userId, id) : false

  return (
    <div className="space-y-4">
      <Link href="/my-sops" className="text-sm text-slate-500">← Procedures</Link>
      <div>
        <h1 className="text-lg font-bold text-slate-900">{version.sop.title}</h1>
        <p className="text-xs text-slate-500">{titleize(version.sop.category)} · v{version.version}</p>
      </div>
      {version.attachmentUrl ? <a href={version.attachmentUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-brand underline">Attached document →</a> : null}
      <SopReader
        sections={version.sections.map((s) => ({ id: s.id, heading: s.heading, body: s.body }))}
        q={q}
        sopId={id}
        canAck={requiresAck}
        alreadyAcked={acked}
      />
    </div>
  )
}
