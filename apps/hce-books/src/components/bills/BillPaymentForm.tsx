"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { DollarSign } from "lucide-react"

type Props = {
  billId: string
  amountDue: number  // cents
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

export function BillPaymentForm({ billId, amountDue }: Props) {
  const router = useRouter()
  const [payAmt, setPayAmt] = useState("")
  const [payDate, setPayDate] = useState(todayStr)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handlePayment() {
    const cents = Math.round((parseFloat(payAmt) || 0) * 100)
    if (cents <= 0) { setError("Enter a payment amount"); return }
    setPaying(true); setError(""); setSuccess("")
    try {
      const res = await fetch("/api/bills/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, amountCents: cents, date: payDate }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to record payment") }
      setSuccess(`Payment of $${(cents / 100).toFixed(2)} recorded (DR AP / CR Cash)`)
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
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <DollarSign className="w-4 h-4 text-green-600" />
        <h3 className="text-sm font-semibold text-gray-800">Record Payment</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Posts <span className="font-mono">DR Accounts Payable / CR Cash</span>. Balance due: ${(amountDue / 100).toFixed(2)}
      </p>

      {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

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
  )
}
