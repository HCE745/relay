import { redirect } from "next/navigation"
import { getPortalSession } from "@/lib/portal-session"
import { getPortalDashboard, listPortalSites } from "@/lib/data/portal"
import { listPendingExtrasForCustomer } from "@/lib/data/change-orders"
import { ensurePayLink } from "@/lib/data/payments"
import { orgHasCapability } from "@/lib/page-guards"
import { isStripeConfigured } from "@/lib/stripe"
import { formatMoney } from "@/lib/money"
import { portalLogout } from "@/lib/portal-actions"
import { ReportIssue } from "@/components/portal/report-issue"
import { PortalExtras } from "@/components/portal/portal-extras"
import { MessageThread } from "@/components/messages/message-thread"
import { listSurveyableJobs } from "@/lib/data/surveys"
import { listPortalQuotes } from "@/lib/data/portal-quotes"
import { listProposalsForCustomer } from "@/lib/data/proposals"
import { formatMoney as fmtMoney } from "@/lib/money"
import { PortalRequestChange, PortalSurvey, PortalQuoteDecision } from "@/components/portal/portal-self-service"

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

  const [data, sites, pendingExtras, canPayOnline, surveyable, quotes, documents] = await Promise.all([
    getPortalDashboard(s.organizationId, s.customerId),
    listPortalSites(s.organizationId, s.customerId),
    listPendingExtrasForCustomer(s.organizationId, s.customerId),
    orgHasCapability(s.organizationId, "billing.onlinePayments"),
    listSurveyableJobs(s.organizationId, s.customerId),
    listPortalQuotes(s.organizationId, s.customerId),
    listProposalsForCustomer(s.organizationId, s.customerId),
  ])
  // Pre-mint pay links for outstanding invoices when online payments are on.
  const payTokens = new Map<string, string>()
  if (canPayOnline && isStripeConfigured()) {
    for (const inv of data.invoices) {
      if (Number(inv.balance) > 0) {
        const token = await ensurePayLink(s.organizationId, inv.id)
        if (token) payTokens.set(inv.id, token)
      }
    }
  }

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

      {quotes.length > 0 ? (
        <Card title="Quotes to review">
          <ul className="divide-y divide-slate-100">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-medium text-slate-800">{q.title}</span> <span className="tabular-nums text-slate-600">{fmtMoney(q.total, q.currency)}</span></span>
                <PortalQuoteDecision estimateId={q.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {surveyable.length > 0 ? (
        <Card title="Rate your recent visits">
          <ul className="divide-y divide-slate-100">
            {surveyable.map((j) => (
              <li key={j.id} className="py-2.5 text-sm">
                <div className="mb-1 text-slate-700">{j.serviceLocation.name} · {j.title} <span className="text-xs text-slate-400">{fmtD(j.actualEnd ?? j.scheduledStart)}</span></div>
                <PortalSurvey jobId={j.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card title="Your documents">
          <ul className="divide-y divide-slate-100">
            {documents.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">Signed proposal{p.signedAt ? ` · ${fmtD(p.signedAt)}` : ""}</span>
                <a href={`/api/public/proposal/${p.token}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">Download PDF</a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {pendingExtras.length > 0 ? (
        <Card title="Extra work awaiting your approval">
          <PortalExtras extras={pendingExtras.map((e) => ({ id: e.id, description: e.description, amount: e.amount.toFixed(2) }))} />
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming service">
          {data.upcoming.length === 0 ? <p className="text-sm text-slate-500">No upcoming visits scheduled.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.upcoming.map((j) => (
                <li key={j.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span><span className="font-medium text-slate-800">{j.serviceLocation.name}</span> · {j.title}</span>
                    <span className="text-slate-500">{fmtDT(j.scheduledStart)}</span>
                  </div>
                  <div className="mt-1"><PortalRequestChange jobId={j.id} label={j.title} /></div>
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
                    <td className="py-2 pl-3 text-right">{payTokens.has(inv.id) ? <a href={`/pay/${payTokens.get(inv.id)}`} className="text-sm font-semibold text-brand hover:underline">Pay now →</a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Messages">
        <MessageThread endpoint="/api/portal/messages" mine="CUSTOMER" />
      </Card>

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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.outcome === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{i.score != null ? `${i.score}%` : "-"} {i.outcome ?? ""}</span>
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
