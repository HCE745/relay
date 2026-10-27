import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { sopsForUser, outstandingAcks } from "@/lib/data/sops"
import { SopSearch } from "@/components/sops/sop-search"

export const dynamic = "force-dynamic"
const CAP = "operations.sopLibrary"
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")
const REASON: Record<string, string> = { never: "Not yet acknowledged", new_version: "Updated — re-acknowledge", expired: "Acknowledgment expired" }

export default async function MySopsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, CAP))) {
    return <div className="py-10 text-center text-sm text-slate-500">Procedures aren&apos;t enabled for this workspace.</div>
  }
  const [outstanding, applicable] = await Promise.all([
    outstandingAcks(orgId, session.userId, session.role),
    sopsForUser(orgId, session.role),
  ])

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">Procedures</h1>

      {outstanding.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-red-700">To acknowledge ({outstanding.length})</h2>
          <ul className="space-y-2">
            {outstanding.map((s) => (
              <li key={s.id}>
                <Link href={`/my-sops/${s.id}`} className="block rounded-2xl border border-red-200 bg-red-50 p-4 active:bg-red-100">
                  <div className="font-semibold text-slate-900">{s.title}</div>
                  <div className="text-xs text-red-700">{REASON[s.reason] ?? "Action needed"} · {titleize(s.category)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Search</h2>
        <SopSearch readerBase="/my-sops" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Your procedures</h2>
        {applicable.length === 0 ? (
          <p className="text-sm text-slate-500">No procedures assigned to you yet.</p>
        ) : (
          <ul className="space-y-2">
            {applicable.map((s) => (
              <li key={s.id}>
                <Link href={`/my-sops/${s.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                  <div className="font-semibold text-slate-900">{s.title}</div>
                  <div className="text-xs text-slate-500">{titleize(s.category)}{s.requiresAck ? " · acknowledgment required" : ""}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
