import { getPayableByToken } from "@/lib/data/payments"
import { isStripeConfigured } from "@/lib/stripe"
import { PayButton } from "@/components/pay/pay-button"

export const dynamic = "force-dynamic"

export default async function PublicPayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params
  const { paid } = await searchParams
  const inv = await getPayableByToken(token)

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {!inv ? (
        <Card><p className="text-center text-sm text-slate-500">This payment link is not valid.</p></Card>
      ) : paid || !inv.payable ? (
        <Card>
          <p className="text-center text-base font-semibold text-slate-900">{paid ? "Thank you — payment received" : `Invoice #${inv.invoiceNumber}`}</p>
          <p className="mt-1 text-center text-sm text-slate-500">
            {paid ? "Your payment is being confirmed and will post to your account shortly." : inv.status === "PAID" ? "This invoice is already paid." : "There is nothing due on this invoice."}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-center text-sm text-slate-500">{inv.orgName}</p>
          <h1 className="mt-1 text-center text-2xl font-bold tracking-tight text-slate-900">Invoice #{inv.invoiceNumber}</h1>
          <div className="my-5 rounded-xl bg-slate-50 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">Amount due</div>
            <div className="text-3xl font-bold tabular-nums text-slate-900">${inv.balance}</div>
            <div className="mt-1 text-xs text-slate-400">{inv.currency}</div>
          </div>
          {isStripeConfigured() ? (
            <PayButton token={token} />
          ) : (
            <p className="text-center text-sm text-slate-500">Online payment isn&apos;t available right now — please contact {inv.orgName}.</p>
          )}
          <p className="mt-3 text-center text-xs text-slate-400">Pay securely by card or bank (ACH) via Stripe.</p>
        </Card>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
}
