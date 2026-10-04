import { redirect } from "next/navigation"
import { getPortalSession } from "@/lib/portal-session"
import { getPortalDashboard, listPortalSites } from "@/lib/data/portal"
import { formatMoney } from "@/lib/money"
import { portalLogout } from "@/lib/portal-actions"
import { ReportIssue } from "@/components/portal/report-issue"

export const dynamic = "force-dynamic"

const fmtDT = (d: Date) => new Date(d).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const fmtD = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
const ISSUE_TONE: Record<string, string> = { OPEN: "bg-amber-100 text-amber-800", ACKNOWLEDGED: "bg-sky-100 text-sky-800", RESOLVED: "bg-emerald-100 text-emerald-800", CLOSED: "bg-slate-100 text-slate-600" }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  )
}

export default async function PortalDashboard() {
  const s = await getPortalSession()
  if (!s) redirect("/portal/login")

  const [data, sites] = await Promise.all([getPortalDashboard(s.organizationId, s.customerId), listPortalSites(s.organizationId, s.customerId)])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{data.customer?.name ?? "Your service"}</h1>
          <p className="text-sm text-slate-500">Welcome, {s.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <ReportIssue sites={sites} />
          <form action={portalLogout}><button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Sign out</button></form>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming service">
          {data.upcoming.length === 0 ? <p className="text-sm text-slate-500">No upcoming visits scheduled.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.upcoming.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-2 text-sm">
                  <span><span className="font-medium text-slate-800">{j.serviceLocation.name}</span> · {j.title}</span>
                  <span className="text-slate-500">{fmtDT(j.scheduledStart)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Invoices">
          {data.invoices.length === 0 ? <p className="text-sm text-slate-500">No invoices.</p> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 font-medium text-slate-800">{inv.number}</td>
                    <td className="py-2 text-slate-500">{inv.status}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-slate-900">{Number(inv.balance) > 0 ? `${formatMoney(inv.balance, inv.currency)} due` : "Paid"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Completed service">
        {data.completed.length === 0 ? <p className="text-sm text-slate-500">No completed visits yet.</p> : (
          <ul className="space-y-3">
            {data.completed.map((j) => (
              <li key={j.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{j.serviceLocation.name} · {j.title}</span>
                  <span className="text-slate-500">{fmtD(j.actualEnd ?? j.scheduledStart)}</span>
                </div>
                {j.photos.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {j.photos.map((p) => (
                      <a key={p.id} href={`/api/portal/photos/${p.id}`} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/portal/photos/${p.id}`} alt={p.caption ?? "Proof photo"} className="h-16 w-16 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                ) : <p className="mt-1 text-xs text-slate-400">No photos for this visit.</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Inspection scores">
          {data.inspections.length === 0 ? <p className="text-sm text-slate-500">No inspections yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.inspections.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span><span className="font-medium text-slate-800">{i.serviceLocation.name}</span> · {i.finalizedAt ? fmtD(i.finalizedAt) : ""}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.outcome === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{i.score != null ? `${i.score}%` : "—"} {i.outcome ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Issues">
          {data.issues.length === 0 ? <p className="text-sm text-slate-500">No issues reported.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.issues.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span><span className="font-medium text-slate-800">{i.title || i.description.slice(0, 40)}</span> <span className="text-slate-400">· {i.serviceLocation?.name ?? ""}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ISSUE_TONE[i.status] ?? "bg-slate-100 text-slate-600"}`}>{i.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
