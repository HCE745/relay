"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Send, DollarSign } from "lucide-react"

type Props = {
  invoiceId: string
  status: string
  amountDue: number   // cents
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

export function InvoiceActions({ invoiceId, status, amountDue }: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [payAmt, setPayAmt] = useState("")
  const [payDate, setPayDate] = useState(todayStr)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSend() {
    setSending(true); setError(""); setSuccess("")
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to send") }
      setSuccess("Invoice sent — ledger entry posted (DR AR / CR Revenue)")
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function handlePayment() {
    const cents = Math.round((parseFloat(payAmt) || 0) * 100)
    if (cents <= 0) { setError("Enter a payment amount"); return }
    setPaying(true); setError(""); setSuccess("")
    try {
      const res = await fetch("/api/invoices/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amountCents: cents, date: payDate }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to record payment") }
      setSuccess(`Payment of $${(cents / 100).toFixed(2)} recorded (DR Cash / CR AR)`)
      setPayAmt("")
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPaying(false)
    }
  }

  const inp = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {status === "DRAFT" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <Send className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">Send Invoice</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Posts <span className="font-mono">DR Accounts Receivable / CR Revenue</span> to the ledger and marks the invoice as Sent.
          </p>
          <button onClick={handleSend} disabled={sending} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {sending ? "Sending…" : "Send Invoice"}
          </button>
        </div>
      )}

      {["SENT", "PARTIAL"].includes(status) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-800">Record Payment</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Posts <span className="font-mono">DR Cash / CR Accounts Receivable</span>. Balance due: ${(amountDue / 100).toFixed(2)}
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number" min="0.01" step="0.01" value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                  placeholder={(amountDue / 100).toFixed(2)}
                  className={`${inp} pl-6 w-36`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inp} />
            </div>
            <button onClick={handlePayment} disabled={paying} className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              {paying ? "Recording…" : "Record Payment"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
