"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Plus, Loader2, Check } from "lucide-react"

type POLine = {
  id: string; description: string | null; qty: number; unitPriceCents: number
  amountCents: number; accountId: string | null; qtyReceived: number; sortOrder: number
}

type Receipt = {
  id: string; poId: string; receivedAt: string; receivedBy: string | null
  notes: string | null; lines: { poLineId: string; qtyReceived: number }[]
}

type PO = {
  id: string; poNumber: string | null; vendorId: string; vendor: { id: string; name: string }
  date: string; expectedDate: string | null; status: string; notes: string | null
  totalCents: number; lines: POLine[]; receipts: Receipt[]
}

type BillLine = {
  id: string; description: string | null; quantity: number; unitPrice: number; amount: number
}

type Bill = {
  id: string; billNumber: string | null; date: string; total: number; status: string
  lines: BillLine[]; vendor: { id: string; name: string }
}

type Props = { po: PO; bills: Bill[]; entityId: string }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-400",
  CANCELLED: "bg-red-100 text-red-400",
}

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
}

export function PODetail({ po, bills, entityId }: Props) {
  const router = useRouter()
  const [status, setStatusState] = useState(po.status)
  const [notes, setNotes] = useState(po.notes ?? "")
  const [lines, setLines] = useState<POLine[]>(po.lines)
  const [receipts, setReceipts] = useState<Receipt[]>(po.receipts)
  const [showReceive, setShowReceive] = useState(false)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>(
    Object.fromEntries(po.lines.map((l) => [l.id, String(Math.max(0, l.qty - l.qtyReceived))]))
  )
  const [receiveNotes, setReceiveNotes] = useState("")
  const [receiving, setReceiving] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState("")

  async function transition(newStatus: string) {
    setTransitioning(true); setError("")
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setStatusState(newStatus)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleReceive() {
    setReceiving(true); setError("")
    const receiptLines = lines
      .map((l) => ({ poLineId: l.id, qtyReceived: parseFloat(receiveQtys[l.id] ?? "0") || 0 }))
      .filter((l) => l.qtyReceived > 0)
    if (receiptLines.length === 0) { setError("Enter at least one received quantity"); setReceiving(false); return }
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: receiptLines, notes: receiveNotes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setStatusState(data.status)
      setLines(data.lines)
      router.refresh()
      setShowReceive(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReceiving(false)
    }
  }

  // Variance detection
  const billTotal = bills.reduce((s, b) => s + b.total, 0)
  const overBill = billTotal > po.totalCents * 1.01
  const priceMismatches: string[] = []
  for (const bill of bills) {
    for (let i = 0; i < bill.lines.length && i < lines.length; i++) {
      const bl = bill.lines[i]; const pl = lines[i]
      if (bl && pl && bl.unitPrice > pl.unitPriceCents * 1.01) {
        priceMismatches.push(bl.description ?? `Line ${i + 1}`)
      }
    }
  }

  const canReceive = ["OPEN", "PARTIALLY_RECEIVED"].includes(status)

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">PO {po.poNumber ?? po.id.slice(0, 8)}</h1>
            <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${STATUS_COLORS[status] ?? ""}`}>
              {status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm text-gray-500">Vendor: {po.vendor.name} · Date: {po.date.slice(0, 10)}{po.expectedDate ? ` · Expected: ${po.expectedDate.slice(0, 10)}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {status === "DRAFT" && (
            <button onClick={() => transition("OPEN")} disabled={transitioning}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit PO"}
            </button>
          )}
          {["OPEN", "PARTIALLY_RECEIVED"].includes(status) && (
            <>
              <button onClick={() => transition("CLOSED")} disabled={transitioning}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
                Close
              </button>
              <button onClick={() => transition("CANCELLED")} disabled={transitioning}
                className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Variance warnings */}
      {(overBill || priceMismatches.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-1">
          {overBill && (
            <div className="flex items-center gap-2 text-yellow-800 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Over-bill warning: billed {fmt(billTotal)} vs PO {fmt(po.totalCents)} (+{fmt(billTotal - po.totalCents)})
            </div>
          )}
          {priceMismatches.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-yellow-800 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Price mismatch on "{name}"
            </div>
          ))}
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
          <span className="text-sm font-mono font-bold text-gray-700">Total: {fmt(po.totalCents)}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Received</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const pct = l.qty > 0 ? Math.min(100, (l.qtyReceived / l.qty) * 100) : 0
              return (
                <tr key={l.id}>
                  <td>{l.description ?? "—"}</td>
                  <td className="text-right font-mono">{l.qty}</td>
                  <td className="text-right font-mono">{fmt(l.unitPriceCents)}</td>
                  <td className="text-right font-mono">{fmt(l.amountCents)}</td>
                  <td className="text-right font-mono">{l.qtyReceived}/{l.qty}</td>
                  <td className="w-32">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Receive goods */}
      {canReceive && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Receive Goods</h2>
            <button onClick={() => setShowReceive((s) => !s)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="w-4 h-4" /> {showReceive ? "Cancel" : "Record Receipt"}
            </button>
          </div>
          {showReceive && (
            <div className="p-5 space-y-4">
              <table className="data-table">
                <thead>
                  <tr><th>Item</th><th>Outstanding</th><th>Receiving Now</th></tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.description ?? `Line ${l.sortOrder + 1}`}</td>
                      <td>{Math.max(0, l.qty - l.qtyReceived)}</td>
                      <td className="w-28">
                        <input type="number" min="0" max={l.qty - l.qtyReceived} step="1"
                          value={receiveQtys[l.id] ?? "0"}
                          onChange={(e) => setReceiveQtys((p) => ({ ...p, [l.id]: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Optional notes" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={handleReceive} disabled={receiving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Receipt
              </button>
            </div>
          )}
          {receipts.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-gray-500 mb-2">{receipts.length} receipt{receipts.length > 1 ? "s" : ""} recorded</p>
              {receipts.map((r) => (
                <div key={r.id} className="text-xs text-gray-600 mb-1">
                  {new Date(r.receivedAt).toLocaleDateString()}{r.notes ? ` — ${r.notes}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matched bills */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Matched Bills ({bills.length})</h2>
          {canReceive && (
            <Link href={`/bills/new?poId=${po.id}`}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="w-4 h-4" /> Create Matched Bill
            </Link>
          )}
        </div>
        {bills.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">No bills matched yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Bill #</th><th>Date</th><th className="text-right">Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/bills/${b.id}`} className="text-blue-600 hover:underline font-medium">{b.billNumber ?? b.id.slice(0, 8)}</Link></td>
                  <td>{b.date.slice(0, 10)}</td>
                  <td className="text-right font-mono">{fmt(b.total)}</td>
                  <td><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {po.notes && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
          <span className="font-medium text-gray-500 uppercase text-xs tracking-wide">Notes: </span>{po.notes}
        </div>
      )}
    </div>
  )
}
