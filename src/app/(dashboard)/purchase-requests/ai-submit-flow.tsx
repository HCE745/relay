"use client"

import { useState, useRef } from "react"
import {
  Plus, Camera, CheckCircle, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Shield, Sparkles, Package, ExternalLink,
  User, X, ArrowLeft, Send, Info,
} from "lucide-react"

interface Asset { id: string; name: string; type: string; qrCode?: string }
interface ApprovalHistory { id: string; action: string; notes: string | null; createdAt: string; approver: { id: string; name: string } }
interface PurchaseRequest {
  id: string; itemName: string; itemDescription: string | null
  estimatedCost: number | null; status: string; referenceNumber: string | null
  approvalPath: string | null; aiItemIdentified: string | null
  aiMatchConfidence: number | null; aiDamageAssessment: string | null
  aiReasoning: string | null; rejectedReason: string | null
  infoRequestMessage: string | null; notes: string | null
  createdAt: string; approvedAt: string | null
  submittedBy: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  asset: { id: string; name: string; type: string } | null
  catalogItem: { id: string; name: string } | null
  approvalHistory: ApprovalHistory[]
}

interface AIAnalysisResult {
  aiItemIdentified: string; aiMatchConfidence: number; aiDamageAssessment: string
  aiReasoning: string; belowConfidenceThreshold: boolean
  catalogItemId: string | null; catalogItemName: string | null
  estimatedCost: number | null; vendorName: string | null
  vendorSku: string | null; replacementUrl: string | null; category: string
  approvalPath: string; policyId: string | null; policyName: string | null; policyReason: string
  matchedConditions: string[]; expectedOutcome: string
}

interface Props {
  initialRequests: PurchaseRequest[]
  assets: Asset[]
  isAdminLevel: boolean
  currentUserId: string
  userRole: string
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:           "bg-gray-100 text-gray-600",
  AI_APPROVED:       "bg-blue-100 text-blue-700",
  AUTO_APPROVED:     "bg-green-100 text-green-700",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED:          "bg-green-100 text-green-700",
  REJECTED:          "bg-red-100 text-red-700",
  NEEDS_REVIEW:      "bg-yellow-100 text-yellow-700",
  INFO_REQUESTED:    "bg-purple-100 text-purple-700",
  CANCELLED:         "bg-gray-100 text-gray-500",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:           "Pending",
  AI_APPROVED:       "Auto-Approved",
  AUTO_APPROVED:     "Auto-Approved",
  AWAITING_APPROVAL: "Awaiting Approval",
  APPROVED:          "Approved",
  REJECTED:          "Rejected",
  NEEDS_REVIEW:      "Needs Review",
  INFO_REQUESTED:    "Info Requested",
  CANCELLED:         "Cancelled",
}

const DAMAGE_COLOR: Record<string, string> = {
  CONFIRMED:    "text-red-600",
  NOT_VISIBLE:  "text-gray-500",
  INCONCLUSIVE: "text-amber-600",
}

const PATH_COLOR: Record<string, string> = {
  AUTO_APPROVE:       "bg-green-50 border-green-200 text-green-800",
  SUPERVISOR:         "bg-blue-50 border-blue-200 text-blue-800",
  DEPARTMENT_MANAGER: "bg-amber-50 border-amber-200 text-amber-800",
  PURCHASING:         "bg-purple-50 border-purple-200 text-purple-800",
}

const PATH_LABEL: Record<string, string> = {
  AUTO_APPROVE:       "Auto-Approved",
  SUPERVISOR:         "Supervisor Approval Required",
  DEPARTMENT_MANAGER: "Department Manager Approval Required",
  PURCHASING:         "Purchasing Department Approval Required",
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  )
}

// ── Submission form (multi-step) ─────────────────────────────────────────────

function SubmitForm({ assets, onSubmitted, onCancel }: {
  assets: Asset[]
  onSubmitted: (req: PurchaseRequest) => void
  onCancel: () => void
}) {
  const [step, setStep]         = useState<"describe" | "analyzing" | "confirm" | "done">("describe")
  const [description, setDesc]  = useState("")
  const [assetId, setAssetId]   = useState("")
  const [notes, setNotes]       = useState("")
  const [photos, setPhotos]     = useState<{ file: File; dataUrl: string }[]>([])
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState("")
  const photoRef = useRef<HTMLInputElement>(null)

  // Derived: use itemName from AI or asset
  const itemName = analysis?.aiItemIdentified ?? ""

  async function addPhoto(file: File) {
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })
    setPhotos(prev => [...prev.slice(0, 2), { file, dataUrl }])
  }

  async function handleAnalyze() {
    if (!description.trim() && !assetId) { setError("Describe what you need or select an asset."); return }
    setError(""); setStep("analyzing")
    try {
      const res = await fetch("/api/purchase-requests/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          photos: photos.map(p => p.dataUrl),
          assetId: assetId || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? "Analysis failed"); setStep("describe"); return
      }
      const result = await res.json() as AIAnalysisResult
      setAnalysis(result)
      setStep("confirm")
    } catch { setError("Network error during analysis"); setStep("describe") }
  }

  async function handleSubmit() {
    if (!analysis) return
    if (!itemName.trim()) { setError("Could not determine item name. Please describe the item."); return }
    setSubmitting(true); setError("")
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemName,
          itemDescription: description.trim() || null,
          estimatedCost:   analysis.estimatedCost,
          assetId:         assetId || null,
          notes:           notes.trim() || null,
          photoData:       photos.map(p => p.dataUrl),
          catalogItemId:   analysis.catalogItemId,
          approvalPolicyId: analysis.policyId ?? null,
          aiItemIdentified:  analysis.aiItemIdentified,
          aiMatchConfidence: analysis.aiMatchConfidence,
          aiDamageAssessment: analysis.aiDamageAssessment,
          aiReasoning:     analysis.aiReasoning,
          approvalPath:    analysis.approvalPath,
          vendorSku:       analysis.vendorSku,
          replacementUrl:  analysis.replacementUrl,
        }),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Submission failed"); return }
      const created = await res.json() as PurchaseRequest
      setStep("done")
      setTimeout(() => onSubmitted(created), 1500)
    } catch { setError("Network error") } finally { setSubmitting(false) }
  }

  if (step === "done") {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Request Submitted</h3>
        <p className="text-sm text-gray-500">Your purchase request has been submitted successfully.</p>
      </div>
    )
  }

  if (step === "analyzing") {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles className="w-6 h-6 text-indigo-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Analyzing Your Request</h3>
        <p className="text-sm text-gray-500">Identifying item, matching catalog, evaluating approval policy…</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      {step === "describe" && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">What do you need? *</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={4}
              placeholder="Describe the item you need and why. Be specific — the AI uses this to identify the correct item from the catalog."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Related Asset (optional)</label>
            <select value={assetId} onChange={e => setAssetId(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— No specific asset —</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Scanning an asset QR code lets us use its stored replacement info.</p>
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Photos (optional, up to 3)</label>
            <div className="flex items-center gap-2 flex-wrap">
              {photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                  <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <button onClick={() => photoRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-gray-400">
                  <Camera className="w-5 h-5 mb-1" />
                  <span className="text-xs">Add</span>
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) addPhoto(f); if (photoRef.current) photoRef.current.value = "" }} className="hidden" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Photos help the AI assess visible damage and improve confidence.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional context for the approver" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleAnalyze} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
              <Sparkles className="w-4 h-4" /> Analyze Request
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && analysis && (
        <div className="space-y-5">
          <button onClick={() => setStep("describe")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to description
          </button>

          {/* Recommendation card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">AI Recommendation</span>
              {analysis.belowConfidenceThreshold && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">Low Confidence — Manual Review</span>
              )}
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Item Detected</p>
                <p className="font-medium text-gray-900">{analysis.aiItemIdentified}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Confidence Score</p>
                <ConfidenceBar confidence={analysis.aiMatchConfidence} />
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Matched Catalog Item</p>
                {analysis.catalogItemName
                  ? <p className="font-medium text-gray-900 flex items-center gap-1"><Package className="w-3.5 h-3.5 text-indigo-500" /> {analysis.catalogItemName}</p>
                  : <p className="text-gray-400 text-xs italic">No catalog match found</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Estimated Cost</p>
                <p className="font-medium text-gray-900">{analysis.estimatedCost != null ? `$${analysis.estimatedCost.toFixed(2)}` : "Unknown"}</p>
              </div>

              {analysis.vendorName && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Vendor</p>
                  <p className="text-gray-700">{analysis.vendorName}{analysis.vendorSku ? ` · ${analysis.vendorSku}` : ""}</p>
                </div>
              )}
              {analysis.replacementUrl && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Replacement URL</p>
                  <a href={analysis.replacementUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs">
                    <ExternalLink className="w-3 h-3" /> View
                  </a>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Damage Assessment</p>
                <p className={`font-medium ${DAMAGE_COLOR[analysis.aiDamageAssessment] ?? "text-gray-600"}`}>
                  {analysis.aiDamageAssessment === "CONFIRMED"   ? "Damage Confirmed" :
                   analysis.aiDamageAssessment === "NOT_VISIBLE" ? "No Visible Damage" :
                   "Inconclusive"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Expected Outcome</p>
                <p className="font-medium text-gray-900">{analysis.expectedOutcome}</p>
              </div>
            </div>

            {/* Approval path */}
            <div className={`mx-5 mb-4 px-4 py-3 border rounded-xl text-sm ${PATH_COLOR[analysis.approvalPath] ?? "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">{PATH_LABEL[analysis.approvalPath] ?? analysis.approvalPath}</span>
              </div>
              <p className="text-xs opacity-80">{analysis.policyReason}</p>
            </div>

            {/* AI reasoning */}
            <div className="px-5 pb-4">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Reasoning</p>
              <p className="text-xs text-gray-600 leading-relaxed">{analysis.aiReasoning}</p>
            </div>
          </div>

          {analysis.belowConfidenceThreshold && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">Confidence is below your organization&apos;s threshold. This request will be flagged for human review before approval.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300">
              {submitting ? "Submitting…" : <><Send className="w-4 h-4" /> Confirm &amp; Submit</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Approver actions ─────────────────────────────────────────────────────────

function ApproverActions({ requestId, onAction }: {
  requestId: string
  onAction: (updated: PurchaseRequest) => void
}) {
  const [action, setAction]       = useState("")
  const [notes, setNotes]         = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState("")

  async function handleAction() {
    if (!action) return
    if ((action === "REJECTED" || action === "INFO_REQUESTED") && !notes.trim()) {
      setError(action === "REJECTED" ? "Rejection reason is required." : "Please enter your question."); return
    }
    setSubmitting(true); setError("")
    try {
      const res = await fetch(`/api/purchase-requests/${requestId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, notes: notes.trim() }),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Action failed"); return }
      const updated = await res.json() as PurchaseRequest
      onAction(updated)
      setAction(""); setNotes("")
    } catch { setError("Network error") } finally { setSubmitting(false) }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Approver Actions</p>
      <div className="flex gap-2 flex-wrap">
        {["APPROVED", "REJECTED", "INFO_REQUESTED"].map(a => (
          <button
            key={a}
            onClick={() => setAction(action === a ? "" : a)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              action === a
                ? a === "APPROVED" ? "bg-green-600 text-white border-green-600"
                  : a === "REJECTED" ? "bg-red-600 text-white border-red-600"
                  : "bg-purple-600 text-white border-purple-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {a === "APPROVED" ? "Approve" : a === "REJECTED" ? "Reject" : "Request Info"}
          </button>
        ))}
      </div>
      {action && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder={action === "APPROVED" ? "Optional note…" : action === "REJECTED" ? "Reason for rejection (required)…" : "What information do you need? (required)"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={handleAction} disabled={submitting} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400">
            {submitting ? "Saving…" : "Submit"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Request card ─────────────────────────────────────────────────────────────

function RequestCard({ request, isAdminLevel, currentUserId, onUpdated }: {
  request: PurchaseRequest
  isAdminLevel: boolean
  currentUserId: string
  onUpdated: (r: PurchaseRequest) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isOwn = request.submittedBy.id === currentUserId
  const canApprove = isAdminLevel && request.status === "AWAITING_APPROVAL"

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{request.itemName}</h3>
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_COLOR[request.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABEL[request.status] ?? request.status}
              </span>
            </div>
            {request.referenceNumber && (
              <p className="text-xs font-mono text-gray-400 mt-0.5">{request.referenceNumber}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              {!isOwn && <span className="flex items-center gap-0.5"><User className="w-3 h-3" /> {request.submittedBy.name}</span>}
              {request.estimatedCost != null && <span>${request.estimatedCost.toFixed(2)}</span>}
              {request.catalogItem && <span className="flex items-center gap-0.5"><Package className="w-3 h-3" /> {request.catalogItem.name}</span>}
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {request.status === "REJECTED" && request.rejectedReason && (
          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{request.rejectedReason}</p>
          </div>
        )}
        {request.status === "INFO_REQUESTED" && request.infoRequestMessage && (
          <div className="mt-2 flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-purple-700">{request.infoRequestMessage}</p>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
          {request.itemDescription && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Description</p>
              <p className="text-sm text-gray-700">{request.itemDescription}</p>
            </div>
          )}

          {/* AI analysis */}
          {request.aiItemIdentified && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> AI Analysis
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">Item Identified</p>
                  <p className="text-gray-700 font-medium">{request.aiItemIdentified}</p>
                </div>
                {request.aiMatchConfidence != null && (
                  <div>
                    <p className="text-gray-400 mb-0.5">Confidence</p>
                    <ConfidenceBar confidence={request.aiMatchConfidence} />
                  </div>
                )}
                {request.aiDamageAssessment && (
                  <div>
                    <p className="text-gray-400 mb-0.5">Damage</p>
                    <p className={`font-medium ${DAMAGE_COLOR[request.aiDamageAssessment] ?? ""}`}>
                      {request.aiDamageAssessment === "CONFIRMED" ? "Confirmed" : request.aiDamageAssessment === "NOT_VISIBLE" ? "Not Visible" : "Inconclusive"}
                    </p>
                  </div>
                )}
                {request.approvalPath && (
                  <div>
                    <p className="text-gray-400 mb-0.5">Approval Path</p>
                    <p className="text-gray-700">{PATH_LABEL[request.approvalPath] ?? request.approvalPath}</p>
                  </div>
                )}
              </div>
              {request.aiReasoning && (
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Reasoning</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{request.aiReasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Approval history */}
          {request.approvalHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Approval History</p>
              <div className="space-y-2">
                {request.approvalHistory.map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      h.action === "APPROVED" ? "bg-green-100" : h.action === "REJECTED" ? "bg-red-100" : "bg-gray-100"
                    }`}>
                      {h.action === "APPROVED" ? <CheckCircle className="w-3 h-3 text-green-600" /> :
                       h.action === "REJECTED" ? <XCircle className="w-3 h-3 text-red-600" /> :
                       <Info className="w-3 h-3 text-gray-500" />}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{h.approver.name}</span>
                      <span className="text-gray-400 ml-1">{h.action.toLowerCase().replace(/_/g, " ")}</span>
                      <span className="text-gray-400 ml-1">· {new Date(h.createdAt).toLocaleDateString()}</span>
                      {h.notes && <p className="text-gray-600 mt-0.5">{h.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canApprove && (
            <ApproverActions requestId={request.id} onAction={onUpdated} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function AISubmitFlow({ initialRequests, assets, isAdminLevel, currentUserId, userRole }: Props) {
  const [requests, setRequests] = useState<PurchaseRequest[]>(initialRequests)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilter] = useState("")

  const canApprove = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(userRole)

  const filtered = filterStatus ? requests.filter(r => r.status === filterStatus) : requests
  const pending  = requests.filter(r => r.status === "AWAITING_APPROVAL").length

  function handleSubmitted(newReq: PurchaseRequest) {
    setRequests(prev => [newReq, ...prev])
    setShowForm(false)
  }

  function handleUpdated(updated: PurchaseRequest) {
    setRequests(prev => prev.map(r => r.id === updated.id ? { ...updated, approvalHistory: (updated as PurchaseRequest & { approvalHistory?: ApprovalHistory[] }).approvalHistory ?? r.approvalHistory } : r))
  }

  if (showForm) {
    return (
      <div className="max-w-xl">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">New Purchase Request</h2>
          <p className="text-sm text-gray-500 mt-0.5">Describe what you need — AI will match it to the catalog and determine the approval path.</p>
        </div>
        <SubmitForm assets={assets} onSubmitted={handleSubmitted} onCancel={() => setShowForm(false)} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Purchase Requests</h2>
          {canApprove && pending > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-0.5">{pending} request{pending !== 1 ? "s" : ""} awaiting your approval</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatus} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Statuses</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="AUTO_APPROVED">Auto-Approved</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="INFO_REQUESTED">Info Requested</option>
          </select>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">No requests yet</p>
          <p className="text-xs mt-1">Submit a purchase request and AI will route it automatically.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium mx-auto">
            <Plus className="w-4 h-4" /> Submit First Request
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(r => (
          <RequestCard
            key={r.id}
            request={r}
            isAdminLevel={isAdminLevel}
            currentUserId={currentUserId}
            onUpdated={handleUpdated}
          />
        ))}
      </div>
    </div>
  )
}
