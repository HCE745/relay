"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, Trash2 } from "lucide-react"

type DepEntry = {
  id: string
  periodNumber: number
  periodDate: string
  amountCents: number
  journalEntryId: string | null
  status: string
}

type Asset = {
  id: string
  name: string
  description: string | null
  category: string
  acquisitionDate: string
  inServiceDate: string
  costCents: number
  salvageValueCents: number
  usefulLifeMonths: number
  depreciationMethod: string
  status: string
  assetAccountId: string
  accumulatedDepreciationAccountId: string
  depreciationExpenseAccountId: string
  sourceAccountId: string
  gainLossAccountId: string | null
  acquisitionEntryId: string | null
  disposedAt: string | null
  disposalProceedsCents: number | null
  depreciationEntries: DepEntry[]
  accumulatedDepreciationCents: number
  netBookValueCents: number
}

type Account = { id: string; code: string; name: string }

type Props = {
  asset: Asset
  cashAccounts: Account[]
  gainLossAccounts: Account[]
  defaultGainLossAccountId: string
}

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  FULLY_DEPRECIATED: "bg-gray-100 text-gray-500",
  DISPOSED: "bg-red-100 text-red-500",
}

export function AssetDetail({ asset, cashAccounts, gainLossAccounts, defaultGainLossAccountId }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(asset.status)
  const [entries, setEntries] = useState<DepEntry[]>(asset.depreciationEntries)
  const [accumDep, setAccumDep] = useState(asset.accumulatedDepreciationCents)
  const [nbv, setNbv] = useState(asset.netBookValueCents)

  // Post depreciation state
  const [showPost, setShowPost] = useState(false)
  const [throughDate, setThroughDate] = useState(todayStr)
  const [posting, setPosting] = useState(false)
  const [postMsg, setPostMsg] = useState("")
  const [postError, setPostError] = useState("")

  // Dispose state
  const [showDispose, setShowDispose] = useState(false)
  const [disposalDate, setDisposalDate] = useState(todayStr)
  const [proceeds, setProceeds] = useState("0")
  const [cashAccountId, setCashAccountId] = useState("")
  const [gainLossAccountId, setGainLossAccountId] = useState(asset.gainLossAccountId ?? defaultGainLossAccountId)
  const [disposing, setDisposing] = useState(false)
  const [disposeError, setDisposeError] = useState("")

  async function handlePostDepreciation() {
    setPosting(true); setPostError(""); setPostMsg("")
    try {
      const res = await fetch(`/api/fixed-assets/${asset.id}/post-depreciation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ throughDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setPostMsg(`Posted ${data.posted} period${data.posted !== 1 ? "s" : ""} of depreciation.`)
      setShowPost(false)
      router.refresh()
    } catch (e) {
      setPostError((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  async function handleDispose() {
    if (!gainLossAccountId) { setDisposeError("Gain/Loss account is required"); return }
    setDisposing(true); setDisposeError("")
    const proceedsCents = Math.round((parseFloat(proceeds) || 0) * 100)
    try {
      const res = await fetch(`/api/fixed-assets/${asset.id}/dispose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposalDate,
          proceedsCents,
          cashAccountId: proceedsCents > 0 ? cashAccountId : undefined,
          gainLossAccountId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setShowDispose(false)
      router.refresh()
    } catch (e) {
      setDisposeError((e as Error).message)
    } finally {
      setDisposing(false)
    }
  }

  const postedCount = entries.filter((e) => e.status === "POSTED").length
  const scheduledCount = entries.filter((e) => e.status === "SCHEDULED").length
  const canPost = status !== "DISPOSED" && scheduledCount > 0
  const canDispose = status !== "DISPOSED"

  const nextDue = entries.find((e) => e.status === "SCHEDULED")

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/fixed-assets" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Fixed Assets
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${STATUS_COLORS[status] ?? ""}`}>
              {status.replace(/_/g, " ")}
            </span>
          </div>
          {asset.description && <p className="text-sm text-gray-500 mt-1">{asset.description}</p>}
        </div>
        <div className="flex gap-2">
          {canPost && (
            <button onClick={() => setShowPost((s) => !s)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              Post Depreciation
            </button>
          )}
          {canDispose && (
            <button onClick={() => setShowDispose((s) => !s)}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" /> Dispose
            </button>
          )}
        </div>
      </div>

      {postMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {postMsg}
        </div>
      )}

      {/* Post depreciation panel */}
      {showPost && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">Post Depreciation</h3>
          <p className="text-xs text-blue-700">
            Posts all SCHEDULED entries with period end date ≤ the date below. Idempotent — already-posted periods are skipped.
          </p>
          {nextDue && (
            <p className="text-xs text-blue-600">Next due: Period {nextDue.periodNumber} ({nextDue.periodDate.slice(0, 10)}, {fmt(nextDue.amountCents)})</p>
          )}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">Post through date</label>
              <input type="date" value={throughDate} onChange={(e) => setThroughDate(e.target.value)}
                className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <button onClick={handlePostDepreciation} disabled={posting}
              className="mt-5 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Post
            </button>
            <button onClick={() => setShowPost(false)}
              className="mt-5 px-3 py-2 text-sm text-blue-700 hover:text-blue-900 transition-colors">
              Cancel
            </button>
          </div>
          {postError && <p className="text-sm text-red-600">{postError}</p>}
        </div>
      )}

      {/* Dispose panel */}
      {showDispose && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-900">Dispose Asset</h3>
          </div>
          <p className="text-xs text-red-700">
            Posts: DR Accumulated Depreciation + DR Cash (if proceeds) + DR/CR Gain/Loss · CR Fixed Asset.
            Remaining scheduled entries are removed. This cannot be undone without voiding the journal entry.
          </p>
          {disposeError && <p className="text-sm text-red-600 font-medium">{disposeError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-red-800 mb-1">Disposal Date</label>
              <input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)}
                className="w-full border border-red-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-800 mb-1">Sale Proceeds ($)</label>
              <input type="number" min="0" step="0.01" value={proceeds} onChange={(e) => setProceeds(e.target.value)}
                className="w-full border border-red-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            {parseFloat(proceeds) > 0 && (
              <div>
                <label className="block text-xs font-medium text-red-800 mb-1">Cash Account (for proceeds)</label>
                <select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}
                  className="w-full border border-red-300 rounded-lg px-3 py-1.5 text-sm bg-white">
                  <option value="">Select…</option>
                  {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-red-800 mb-1">Gain/Loss Account *</label>
              <select value={gainLossAccountId} onChange={(e) => setGainLossAccountId(e.target.value)}
                className="w-full border border-red-300 rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value="">Select…</option>
                {gainLossAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 space-y-1">
            <div>Net book value: {fmt(nbv)} (cost {fmt(asset.costCents)} − accum dep {fmt(accumDep)})</div>
            <div>Proceeds: {fmt(Math.round((parseFloat(proceeds) || 0) * 100))}</div>
            <div className="font-semibold">
              {(() => {
                const gl = Math.round((parseFloat(proceeds) || 0) * 100) - nbv
                return gl > 0 ? `Gain: ${fmt(gl)}` : gl < 0 ? `Loss: ${fmt(-gl)}` : "No gain or loss"
              })()}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDispose} disabled={disposing}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
              {disposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Confirm Disposal
            </button>
            <button onClick={() => setShowDispose(false)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Cost", value: fmt(asset.costCents) },
          { label: "Accum. Depreciation", value: `(${fmt(accumDep)})`, cls: "text-orange-600" },
          { label: "Net Book Value", value: fmt(nbv), cls: "text-blue-700 font-bold" },
          { label: "Progress", value: `${postedCount} / ${asset.usefulLifeMonths} months` },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`mt-1 text-lg font-mono font-semibold ${cls ?? "text-gray-900"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Info row */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div><dt className="text-gray-400 text-xs uppercase">Category</dt><dd className="mt-0.5 font-medium">{asset.category}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase">Method</dt><dd className="mt-0.5 font-medium">{asset.depreciationMethod.replace(/_/g, " ")}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase">Useful Life</dt><dd className="mt-0.5 font-medium">{asset.usefulLifeMonths} months</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase">Acquired</dt><dd className="mt-0.5">{asset.acquisitionDate.slice(0, 10)}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase">In Service</dt><dd className="mt-0.5">{asset.inServiceDate.slice(0, 10)}</dd></div>
          <div><dt className="text-gray-400 text-xs uppercase">Salvage Value</dt><dd className="mt-0.5">{fmt(asset.salvageValueCents)}</dd></div>
          {asset.disposedAt && <div><dt className="text-gray-400 text-xs uppercase">Disposed</dt><dd className="mt-0.5">{asset.disposedAt.slice(0, 10)}</dd></div>}
          {asset.acquisitionEntryId && (
            <div><dt className="text-gray-400 text-xs uppercase">Acquisition Entry</dt>
              <dd className="mt-0.5 font-mono text-xs text-gray-500">{asset.acquisitionEntryId.slice(0, 12)}…</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Depreciation schedule */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Depreciation Schedule ({postedCount} posted, {scheduledCount} scheduled)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5 w-16">Period</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Period End</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Amount</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2.5">Journal Entry</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`border-b border-gray-100 ${e.status === "POSTED" ? "bg-green-50/30" : ""}`}>
                  <td className="px-4 py-2.5 text-sm font-mono text-gray-600">{e.periodNumber}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{e.periodDate.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">{fmt(e.amountCents)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === "POSTED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-400">
                    {e.journalEntryId ? e.journalEntryId.slice(0, 12) + "…" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
