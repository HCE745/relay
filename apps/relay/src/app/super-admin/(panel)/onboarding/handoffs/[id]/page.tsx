"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ChevronLeft, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Building2, User, Mail, Phone, FileText, Calendar, TrendingUp,
  FlaskConical,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type HandoffProspect = {
  id: string
  companyName: string
  website: string | null
  industry: string | null
  headquartersCity: string | null
  headquartersState: string | null
  onboardingStatus: string
  relayOrganizationId: string | null
  contacts: Array<{ id: string; name: string; title: string | null; email: string | null; phone: string | null }>
}

type HandoffOpportunity = {
  id: string
  title: string
  stage: string
  product: string
  value: string | null
  estimatedValue: string | null
  closeDate: string | null
  qualificationStatus: string | null
  leadSource: string | null
  notes: string | null
}

type Handoff = {
  id: string
  companyName: string
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string | null
  onboardingType: string
  isTest: boolean
  plan: string
  estimatedFacilities: number
  trialStartDate: string | null
  salesNotes: string | null
  customerAgreementConfirmed: boolean
  status: string
  submittedById: string | null
  submittedByName: string
  reviewedByName: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  customerOnboardingId: string | null
  createdAt: string
  updatedAt: string
  prospect: HandoffProspect | null
  opportunity: HandoffOpportunity | null
}

const STATUS_COLOR: Record<string, string> = {
  pending_review: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  accepted:       "bg-green-900/50 text-green-300 border-green-700",
  rejected:       "bg-red-900/50 text-red-300 border-red-700",
  cancelled:      "bg-gray-800 text-gray-500 border-gray-700",
}
const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  accepted:       "Accepted",
  rejected:       "Rejected",
  cancelled:      "Cancelled",
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="text-xs font-semibold capitalize text-indigo-300 bg-indigo-900/40 border border-indigo-700/50 px-2 py-0.5 rounded">
      {plan}
    </span>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-800 last:border-0">
      <div className="text-xs font-semibold text-gray-500 w-36 shrink-0 pt-0.5">{label}</div>
      <div className="text-sm text-gray-200 min-w-0">{value ?? <span className="text-gray-600">—</span>}</div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function HandoffReviewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData]           = useState<Handoff | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Accept state
  const [accepting, setAccepting] = useState(false)
  const [confirmAccept, setConfirmAccept] = useState(false)

  // Reject state
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejecting, setRejecting]   = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/handoffs/${id}`)
      if (!res.ok) { setError("Failed to load handoff"); return }
      setData(await res.json() as Handoff)
    } catch {
      setError("Failed to load handoff")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleAccept() {
    if (!confirmAccept) { setConfirmAccept(true); return }
    setAccepting(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/super-admin/handoffs/${id}/accept`, { method: "POST" })
      const json = await res.json() as { customerOnboardingId?: string; error?: string }
      if (!res.ok) { setActionError(json.error ?? "Failed to accept"); setConfirmAccept(false); return }
      // Redirect to the new CustomerOnboarding record
      router.push(`/super-admin/onboarding/${json.customerOnboardingId}`)
    } catch {
      setActionError("Something went wrong. Please try again.")
      setConfirmAccept(false)
    } finally {
      setAccepting(false)
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectReason.trim()) return
    setRejecting(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/super-admin/handoffs/${id}/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: rejectReason.trim() }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setActionError(json.error ?? "Failed to reject"); return }
      // Reload to show rejected state
      setShowRejectForm(false)
      setRejectReason("")
      void load()
    } catch {
      setActionError("Something went wrong. Please try again.")
    } finally {
      setRejecting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-red-400 text-sm">{error ?? "Handoff not found."}</p>
        <Link href="/super-admin/onboarding?tab=queue" className="text-indigo-400 text-sm mt-2 inline-block hover:text-indigo-300">
          ← Back to queue
        </Link>
      </div>
    )
  }

  const isPending = data.status === "pending_review"
  const statusCfg = STATUS_COLOR[data.status] ?? "bg-gray-800 text-gray-400 border-gray-700"

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/super-admin/onboarding?tab=queue"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-5 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to Handoff Queue
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-bold text-white">{data.companyName}</h1>
            {data.isTest && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded bg-amber-900/50 text-amber-300 border border-amber-700/60">
                <FlaskConical className="w-3 h-3" />
                TEST ORG
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Submitted by <span className="text-gray-300">{data.submittedByName}</span>
            {" · "}{format(new Date(data.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded border shrink-0 ${statusCfg}`}>
          {STATUS_LABEL[data.status] ?? data.status}
        </span>
      </div>

      {/* Accepted: show link to CustomerOnboarding */}
      {data.status === "accepted" && data.customerOnboardingId && (
        <div className="mb-5 p-4 bg-green-900/20 border border-green-700/50 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-sm text-green-300">
              Accepted by <strong>{data.reviewedByName}</strong> on {data.reviewedAt ? format(new Date(data.reviewedAt), "MMM d, yyyy") : "—"}
            </span>
          </div>
          <Link
            href={`/super-admin/onboarding/${data.customerOnboardingId}`}
            className="text-xs font-semibold text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
          >
            View Onboarding →
          </Link>
        </div>
      )}

      {/* Rejected: show reason */}
      {data.status === "rejected" && (
        <div className="mb-5 p-4 bg-red-900/20 border border-red-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-1.5">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm font-semibold text-red-300">
              Rejected by {data.reviewedByName} on {data.reviewedAt ? format(new Date(data.reviewedAt), "MMM d, yyyy") : "—"}
            </span>
          </div>
          {data.rejectionReason && (
            <p className="text-sm text-red-200/80 ml-6">{data.rejectionReason}</p>
          )}
        </div>
      )}

      {/* Cancelled */}
      {data.status === "cancelled" && (
        <div className="mb-5 p-3 bg-gray-800/50 border border-gray-700 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm text-gray-400">This handoff was cancelled by the sales rep.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Customer Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-white">Customer Information</h2>
          </div>
          <div>
            <FieldRow label="Contact Name"  value={data.primaryContactName} />
            <FieldRow label="Email"         value={
              <a href={`mailto:${data.primaryContactEmail}`} className="text-indigo-400 hover:text-indigo-300">
                {data.primaryContactEmail}
              </a>
            } />
            <FieldRow label="Phone"         value={data.primaryContactPhone} />
            <FieldRow label="Plan"          value={<PlanBadge plan={data.plan} />} />
            <FieldRow label="Facilities"    value={data.estimatedFacilities} />
            {data.trialStartDate && (
              <FieldRow label="Trial Start" value={format(new Date(data.trialStartDate), "MMM d, yyyy")} />
            )}
            <FieldRow label="Agreement"     value={
              data.customerAgreementConfirmed
                ? <span className="flex items-center gap-1 text-green-400 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmed by sales rep</span>
                : <span className="text-red-400 text-xs">Not confirmed</span>
            } />
          </div>
        </div>

        {/* CRM Context */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-white">CRM Context</h2>
          </div>
          {data.prospect ? (
            <div>
              <FieldRow label="Prospect"     value={
                <Link href={`/sales/prospects/${data.prospect.id}`} className="text-indigo-400 hover:text-indigo-300">
                  {data.prospect.companyName} →
                </Link>
              } />
              {data.prospect.industry && (
                <FieldRow label="Industry"   value={data.prospect.industry} />
              )}
              {(data.prospect.headquartersCity || data.prospect.headquartersState) && (
                <FieldRow label="HQ"         value={[data.prospect.headquartersCity, data.prospect.headquartersState].filter(Boolean).join(", ")} />
              )}
              {data.prospect.website && (
                <FieldRow label="Website"    value={
                  <a href={data.prospect.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 break-all">
                    {data.prospect.website}
                  </a>
                } />
              )}
              {data.prospect.contacts.length > 0 && (
                <FieldRow label="Contact(s)" value={
                  <div className="space-y-0.5">
                    {data.prospect.contacts.map(c => (
                      <div key={c.id} className="text-xs">
                        <span className="text-gray-200">{c.name}</span>
                        {c.title && <span className="text-gray-500"> · {c.title}</span>}
                      </div>
                    ))}
                  </div>
                } />
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No prospect linked.</p>
          )}

          {data.opportunity && (
            <>
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-bold text-gray-400">Opportunity</span>
                </div>
                <FieldRow label="Title"  value={data.opportunity.title} />
                <FieldRow label="Stage"  value={data.opportunity.stage} />
                {data.opportunity.value && (
                  <FieldRow label="Value" value={`$${parseFloat(data.opportunity.value).toLocaleString()}`} />
                )}
                {data.opportunity.closeDate && (
                  <FieldRow label="Close Date" value={format(new Date(data.opportunity.closeDate), "MMM d, yyyy")} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Sales Notes */}
        {data.salesNotes && (
          <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-white">Sales Notes</h2>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{data.salesNotes}</p>
          </div>
        )}
      </div>

      {/* ── Actions (pending only) ───────────────────────────────────────────── */}
      {isPending && (
        <div className="mt-6 space-y-3">
          {actionError && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{actionError}</p>
            </div>
          )}

          {/* Accept */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Accept Handoff</h3>
                <p className="text-xs text-gray-500">
                  Creates the customer organization and opens the white-glove onboarding workflow.
                  No invitation or trial is activated automatically.
                </p>
              </div>
              <button
                onClick={() => void handleAccept()}
                disabled={accepting}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0",
                  confirmAccept
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white",
                  accepting ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {accepting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {accepting ? "Accepting…" : confirmAccept ? "Confirm Accept" : "Accept"}
              </button>
            </div>
            {confirmAccept && !accepting && (
              <div className="mt-3 p-3 bg-green-900/20 border border-green-700/40 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <div className="text-xs text-green-300">
                  <strong>Ready to confirm?</strong> This will create a new organization for <strong>{data.companyName}</strong> and open the onboarding workflow. Click &quot;Confirm Accept&quot; to proceed.
                  <button
                    onClick={() => setConfirmAccept(false)}
                    className="ml-3 text-green-400/60 hover:text-green-400 underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reject */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Reject Handoff</h3>
                <p className="text-xs text-gray-500">
                  Returns the request to the sales rep with a reason. They can re-submit after addressing the issue.
                </p>
              </div>
              {!showRejectForm && (
                <button
                  onClick={() => { setShowRejectForm(true); setConfirmAccept(false) }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors shrink-0"
                >
                  Reject
                </button>
              )}
            </div>

            {showRejectForm && (
              <form onSubmit={(e) => void handleReject(e)} className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Rejection reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain what needs to be resolved before this can be accepted…"
                    rows={3}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowRejectForm(false); setRejectReason("") }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejecting || !rejectReason.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {rejecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {rejecting ? "Rejecting…" : "Confirm Rejection"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="mt-6 flex gap-4 text-[11px] text-gray-600">
        <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Created {format(new Date(data.createdAt), "MMM d, yyyy")}</div>
        <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {data.primaryContactEmail}</div>
        {data.primaryContactPhone && (
          <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {data.primaryContactPhone}</div>
        )}
      </div>
    </div>
  )
}
