"use client"

import { useState } from "react"
import { ShoppingCart, Plus, Check, X, ChevronDown, ChevronUp, Sparkles, AlertTriangle } from "lucide-react"

interface Asset { id: string; name: string; type: string }
interface User  { id: string; name: string }
interface PurchaseRequest {
  id: string
  itemName: string
  itemDescription: string | null
  estimatedCost: number | null
  photoUrl: string | null
  aiVerified: boolean
  aiConfidence: number | null
  aiAnalysis: string | null
  status: string
  rejectedReason: string | null
  notes: string | null
  createdAt: string
  submittedBy: User
  approvedBy: User | null
  asset: Asset | null
}

interface Props {
  initialRequests: PurchaseRequest[]
  assets: Asset[]
  isAdminLevel: boolean
  featureEnabled: boolean
  itemLimit: number | null
  monthlyLimit: number | null
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:      "bg-gray-100 text-gray-600",
  AI_APPROVED:  "bg-blue-100 text-blue-700",
  APPROVED:     "bg-green-100 text-green-700",
  REJECTED:     "bg-red-100 text-red-700",
  NEEDS_REVIEW: "bg-yellow-100 text-yellow-700",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:      "Pending",
  AI_APPROVED:  "Auto-Approved",
  APPROVED:     "Approved",
  REJECTED:     "Rejected",
  NEEDS_REVIEW: "Needs Review",
}

function SubmitForm({
  assets,
  itemLimit,
  onSubmit,
  onCancel,
}: {
  assets: Asset[]
  itemLimit: number | null
  onSubmit: (req: PurchaseRequest) => void
  onCancel: () => void
}) {
  const [itemName, setItemName]         = useState("")
  const [itemDescription, setItemDesc]  = useState("")
  const [estimatedCost, setCost]        = useState("")
  const [photoUrl, setPhotoUrl]         = useState("")
  const [assetId, setAssetId]           = useState("")
  const [notes, setNotes]               = useState("")
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState("")
  const [submitted, setSubmitted]       = useState<PurchaseRequest | null>(null)

  const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = `${inputCls} bg-white`

  async function handleSubmit() {
    if (!itemName.trim()) { setError("Item name is required."); return }
    if (itemLimit && estimatedCost && Number(estimatedCost) > itemLimit) {
      setError(`Estimated cost exceeds the per-item limit of $${itemLimit}.`)
      return
    }
    setSubmitting(true); setError("")
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: itemName.trim(),
          itemDescription: itemDescription || null,
          estimatedCost: estimatedCost ? Number(estimatedCost) : null,
          photoUrl: photoUrl.trim() || null,
          assetId: assetId || null,
          notes: notes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubmitted(data)
        onSubmit(data)
      } else {
        const d = await res.json()
        setError(d.error ?? "Failed to submit")
      }
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const autoApproved = submitted.status === "AI_APPROVED"
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className={`flex items-start gap-3 p-4 rounded-lg ${autoApproved ? "bg-blue-50 border border-blue-200" : "bg-yellow-50 border border-yellow-200"}`}>
          {autoApproved
            ? <><Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">AI verified and auto-approved!</p>
                  <p className="text-xs text-blue-600 mt-0.5">Your request has been approved. A manager will follow up with next steps.</p>
                  {submitted.aiAnalysis && <p className="text-xs text-blue-700 mt-2 italic">{submitted.aiAnalysis}</p>}
                </div></>
            : <><AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Request submitted for review</p>
                  <p className="text-xs text-yellow-600 mt-0.5">A manager will review your request shortly.</p>
                  {submitted.aiAnalysis && <p className="text-xs text-yellow-700 mt-2 italic">AI analysis: {submitted.aiAnalysis}</p>}
                </div></>
          }
        </div>
        <button onClick={onCancel} className="mt-4 w-full py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Done</button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">New Purchase Request</h3>
      {itemLimit && <p className="text-xs text-gray-500">Per-item limit: <span className="font-medium">${itemLimit.toLocaleString()}</span></p>}

      {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Item name *</label>
        <input value={itemName} onChange={e => setItemName(e.target.value)} className={inputCls} placeholder="e.g. Replacement compressor unit" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea value={itemDescription} onChange={e => setItemDesc(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Additional details about why this is needed…" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estimated cost ($)</label>
          <input type="number" min="0" step="0.01" value={estimatedCost} onChange={e => setCost(e.target.value)} className={inputCls} placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Related asset (optional)</label>
          <select value={assetId} onChange={e => setAssetId(e.target.value)} className={selectCls}>
            <option value="">None</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Photo of damage / item (URL)
          <span className="ml-1.5 text-gray-400 font-normal">— AI will verify if provided</span>
        </label>
        <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className={inputCls} placeholder="https://…" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Additional notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Any other context for approvers…" />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button
          type="button"
          disabled={submitting || !itemName.trim()}
          onClick={handleSubmit}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </div>
    </div>
  )
}

function RequestCard({
  request,
  isAdminLevel,
  onUpdate,
}: {
  request: PurchaseRequest
  isAdminLevel: boolean
  onUpdate: (updated: PurchaseRequest) => void
}) {
  const [expanded, setExpanded]       = useState(false)
  const [updating, setUpdating]       = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showReject, setShowReject]   = useState(false)

  async function updateStatus(status: string, extraBody?: object) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/purchase-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extraBody }),
      })
      if (res.ok) onUpdate(await res.json())
    } finally {
      setUpdating(false); setShowReject(false)
    }
  }

  const dateStr = new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const needsReview = ["PENDING", "NEEDS_REVIEW"].includes(request.status)

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm">{request.itemName}</span>
            {request.estimatedCost != null && (
              <span className="text-xs text-gray-600">${request.estimatedCost.toLocaleString()}</span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[request.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL[request.status] ?? request.status}
            </span>
            {request.aiVerified && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <Sparkles className="w-3 h-3" />
                AI verified
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
            {isAdminLevel && <span>By: {request.submittedBy.name}</span>}
            {request.asset && <span>Asset: {request.asset.name}</span>}
            <span>{dateStr}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
          {request.itemDescription && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-800">{request.itemDescription}</p>
            </div>
          )}
          {request.photoUrl && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={request.photoUrl} alt="damage photo" className="max-h-48 rounded-lg border border-gray-200 object-contain" />
            </div>
          )}
          {request.aiAnalysis && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-100 bg-blue-50">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700 mb-0.5">AI Analysis</p>
                <p className="text-xs text-blue-800">{request.aiAnalysis}</p>
                {request.aiConfidence != null && (
                  <p className="text-xs text-blue-500 mt-1">Confidence: {Math.round(request.aiConfidence * 100)}%</p>
                )}
              </div>
            </div>
          )}
          {request.notes && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-800">{request.notes}</p>
            </div>
          )}
          {request.rejectedReason && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xs text-red-700"><span className="font-medium">Rejected: </span>{request.rejectedReason}</p>
            </div>
          )}
          {request.approvedBy && (
            <p className="text-xs text-gray-400">
              {request.status === "APPROVED" ? "Approved" : "Handled"} by {request.approvedBy.name}
            </p>
          )}

          {isAdminLevel && needsReview && (
            <div className="space-y-2 pt-1">
              {!showReject ? (
                <div className="flex gap-2">
                  <button
                    disabled={updating}
                    onClick={() => updateStatus("APPROVED")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 text-xs hover:bg-green-100 disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    Approve
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => setShowReject(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs hover:bg-red-100 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowReject(false)} className="flex-1 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                    <button
                      disabled={updating}
                      onClick={() => updateStatus("REJECTED", { rejectedReason: rejectReason })}
                      className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PurchaseRequestsClient({
  initialRequests, assets, isAdminLevel, featureEnabled, itemLimit,
}: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [creating, setCreating] = useState(false)

  function handleNewRequest(req: PurchaseRequest) {
    setRequests(prev => [req, ...prev])
    setCreating(false)
  }

  function handleUpdate(updated: PurchaseRequest) {
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  const pending   = requests.filter(r => ["PENDING", "NEEDS_REVIEW"].includes(r.status))
  const rest      = requests.filter(r => !["PENDING", "NEEDS_REVIEW"].includes(r.status))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          {isAdminLevel && pending.length > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              {pending.length} pending review
            </span>
          )}
        </div>
        {!creating && featureEnabled && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      {creating && (
        <SubmitForm
          assets={assets}
          itemLimit={itemLimit}
          onSubmit={handleNewRequest}
          onCancel={() => setCreating(false)}
        />
      )}

      {requests.length === 0 && !creating ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No purchase requests</p>
          {featureEnabled && <p className="text-gray-400 text-xs mt-1">Use the button above to submit a request.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && isAdminLevel && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Needs Review</p>
          )}
          {pending.map(r => <RequestCard key={r.id} request={r} isAdminLevel={isAdminLevel} onUpdate={handleUpdate} />)}
          {rest.length > 0 && pending.length > 0 && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">All Requests</p>
          )}
          {rest.map(r => <RequestCard key={r.id} request={r} isAdminLevel={isAdminLevel} onUpdate={handleUpdate} />)}
        </div>
      )}
    </div>
  )
}
