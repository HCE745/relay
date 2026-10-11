import { getProposalByToken } from "@/lib/data/proposals"
import { ProposalAccept } from "@/components/proposals/proposal-accept"

export const dynamic = "force-dynamic"

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = await getProposalByToken(token)
  const s = p?.snapshot

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {!p || !s ? (
        <Card><p className="text-center text-sm text-slate-500">This proposal link is not valid.</p></Card>
      ) : (
        <>
          <div className="mb-4 text-center">
            <p className="text-sm text-slate-500">{s.orgName}</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{s.title}</h1>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Proposal · {p.status.toLowerCase()}</p>
          </div>
          <Card>
            <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-3 text-sm">
              <Meta label="Frequency" value={s.frequency} />
              <Meta label="Pricing" value={s.pricing} />
              <Meta label="Valid until" value={s.validUntil} />
            </div>
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-xs uppercase tracking-wide text-slate-400"><th className="py-1 text-left">Item</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.lines.map((l, i) => (
                  <tr key={i}><td className="py-1.5 text-slate-800">{l.description}</td><td className="py-1.5 text-right text-slate-500">{l.qty}</td><td className="py-1.5 text-right text-slate-500">{l.rate}</td><td className="py-1.5 text-right text-slate-800">{l.amount}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-end gap-6 border-t border-slate-100 pt-2 text-sm">
              <span className="font-semibold text-slate-900">Total</span><span className="font-semibold tabular-nums text-slate-900">{s.total}</span>
            </div>
            {p.terms ? <div className="mt-4"><div className="text-xs uppercase tracking-wide text-slate-400">Terms</div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{p.terms}</p></div> : null}
            <div className="mt-4"><a href={`/api/public/proposal/${token}/pdf`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">Download PDF</a></div>
          </Card>

          <div className="mt-5">
            {p.status === "ACCEPTED" ? (
              <Card><p className="text-center text-sm text-emerald-700">Accepted{p.signerName ? ` by ${p.signerName}` : ""}{p.signedAt ? ` on ${new Date(p.signedAt).toLocaleDateString()}` : ""}.</p></Card>
            ) : p.status === "DECLINED" ? (
              <Card><p className="text-center text-sm text-slate-500">This proposal was declined.</p></Card>
            ) : (
              <Card><ProposalAccept token={token} /></Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div> }
function Meta({ label, value }: { label: string; value: string }) { return <div><div className="text-xs uppercase tracking-wide text-slate-400">{label}</div><div className="text-slate-800">{value}</div></div> }
