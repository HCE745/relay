"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, AlertTriangle, Building2, Globe, Loader2, User, ChevronDown, ChevronUp, Calendar, Clock } from "lucide-react"

type DuplicateInfo = {
  id: string
  companyName: string
  assignedToName: string | null
  currentCrmStatus: string
}

const INTERACTION_TYPES = [
  { value: "CALL_CONNECTED",    label: "Phone Call" },
  { value: "CALL_ATTEMPTED",    label: "Call Attempted" },
  { value: "EMAIL_SENT",        label: "Email" },
  { value: "LINKEDIN_MESSAGE",  label: "LinkedIn Message" },
  { value: "MEETING_HELD",      label: "In-Person Meeting" },
  { value: "NOTE_ADDED",        label: "Note" },
]

const FOLLOWUP_TYPES = [
  { value: "call",     label: "Phone Call" },
  { value: "email",    label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other",    label: "Other" },
]

function nowLocalDatetime(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

function todayPlusOne(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function AddProspectModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Company fields
  const [companyName, setCompanyName] = useState("")
  const [website, setWebsite] = useState("")
  const [industry, setIndustry] = useState("")

  // Contact fields
  const [showContact, setShowContact] = useState(false)
  const [contactName, setContactName] = useState("")
  const [contactTitle, setContactTitle] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactMobile, setContactMobile] = useState("")

  // Interaction fields
  const [showInteraction, setShowInteraction] = useState(false)
  const [interactionType, setInteractionType] = useState("CALL_CONNECTED")
  const [interactionOutcome, setInteractionOutcome] = useState("")
  const [interactionOccurredAt, setInteractionOccurredAt] = useState(nowLocalDatetime())
  const [interactionDuration, setInteractionDuration] = useState("")
  const [interactionNotes, setInteractionNotes] = useState("")
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false)
  const [followUpTitle, setFollowUpTitle] = useState("")
  const [followUpType, setFollowUpType] = useState("call")
  const [followUpDueAt, setFollowUpDueAt] = useState(todayPlusOne())

  // Duplicate confirmation state
  const [dupWarning, setDupWarning] = useState<{ message: string; existing: DuplicateInfo } | null>(null)

  function resetForm() {
    setCompanyName(""); setWebsite(""); setIndustry("")
    setShowContact(false)
    setContactName(""); setContactTitle(""); setContactEmail(""); setContactPhone(""); setContactMobile("")
    setShowInteraction(false)
    setInteractionType("CALL_CONNECTED"); setInteractionOutcome("")
    setInteractionOccurredAt(nowLocalDatetime())
    setInteractionDuration(""); setInteractionNotes("")
    setScheduleFollowUp(false); setFollowUpTitle(""); setFollowUpType("call")
    setFollowUpDueAt(todayPlusOne())
    setDupWarning(null); setError(null)
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  async function submit(confirmDuplicate: boolean) {
    if (!companyName.trim()) {
      setError("Company name is required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const initialContact = showContact && contactName.trim() ? {
        name: contactName.trim(),
        title: contactTitle.trim() || null,
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        mobile: contactMobile.trim() || null,
      } : null

      const initialInteraction = showInteraction ? {
        activityType: interactionType,
        outcome: interactionOutcome.trim() || null,
        occurredAt: interactionOccurredAt ? new Date(interactionOccurredAt).toISOString() : new Date().toISOString(),
        durationMinutes: interactionDuration ? parseInt(interactionDuration, 10) : null,
        notes: interactionNotes.trim() || null,
      } : null

      const followUpTask = showInteraction && scheduleFollowUp && followUpTitle.trim() ? {
        title: followUpTitle.trim(),
        taskType: followUpType,
        dueAt: followUpDueAt ? new Date(followUpDueAt).toISOString() : null,
      } : null

      const res = await fetch("/api/sales/prospects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          website: website.trim() || null,
          industry: industry.trim() || null,
          confirmDuplicate,
          initialContact,
          initialInteraction,
          followUpTask,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        setDupWarning({ message: data.message, existing: data.existing })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Failed to create prospect")
        return
      }

      handleClose()
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Prospect
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            {/* Duplicate confirmation dialog */}
            {dupWarning ? (
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Similar company already exists</h2>
                    <p className="text-sm text-gray-400 mt-1">{dupWarning.message}</p>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-5 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className="font-medium text-gray-200">{dupWarning.existing.companyName}</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-5">
                    Owned by {dupWarning.existing.assignedToName ?? "unassigned"} ·{" "}
                    <span className="capitalize">{dupWarning.existing.currentCrmStatus.replace(/_/g, " ")}</span>
                  </p>
                </div>

                <p className="text-xs text-amber-400/80 mb-5">
                  Creating this prospect will flag it for admin review.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setDupWarning(null)}
                    className="flex-1 px-3 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                    disabled={saving}
                  >
                    Cancel — search for existing
                  </button>
                  <button
                    onClick={() => submit(true)}
                    disabled={saving}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-600 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Yes, different company
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
                  <h2 className="text-base font-semibold text-white">Add Prospect</h2>
                  <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

                  {/* Company fields */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Acme Manufacturing"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-600" />
                      <input
                        type="text"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        placeholder="acme.com"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Industry</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      placeholder="Manufacturing"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Initial contact toggle */}
                  <button
                    type="button"
                    onClick={() => setShowContact(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    {showContact ? "Hide" : "Add"} initial contact
                    {showContact ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showContact && (
                    <div className="space-y-3 p-3 bg-gray-800/50 rounded-xl border border-gray-800">
                      <p className="text-xs text-gray-500">Initial contact (optional)</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={e => setContactName(e.target.value)}
                          placeholder="Jane Smith"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Title</label>
                          <input
                            type="text"
                            value={contactTitle}
                            onChange={e => setContactTitle(e.target.value)}
                            placeholder="Operations Manager"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone</label>
                          <input
                            type="text"
                            value={contactPhone}
                            onChange={e => setContactPhone(e.target.value)}
                            placeholder="(555) 000-0000"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Mobile</label>
                          <input
                            type="text"
                            value={contactMobile}
                            onChange={e => setContactMobile(e.target.value)}
                            placeholder="(555) 000-0000"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          placeholder="jane@acme.com"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Initial interaction toggle */}
                  <button
                    type="button"
                    onClick={() => setShowInteraction(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {showInteraction ? "Hide" : "Log"} initial interaction
                    {showInteraction ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showInteraction && (
                    <div className="space-y-3 p-3 bg-gray-800/50 rounded-xl border border-gray-800">
                      <p className="text-xs text-gray-500">Initial interaction (optional)</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Type</label>
                          <select
                            value={interactionType}
                            onChange={e => setInteractionType(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          >
                            {INTERACTION_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">
                            <Clock className="inline w-3 h-3 mr-1" />Duration (min)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={interactionDuration}
                            onChange={e => setInteractionDuration(e.target.value)}
                            placeholder="15"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          value={interactionOccurredAt}
                          onChange={e => setInteractionOccurredAt(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Outcome</label>
                        <input
                          type="text"
                          value={interactionOutcome}
                          onChange={e => setInteractionOutcome(e.target.value)}
                          placeholder="Left voicemail, interested, requested follow-up…"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes</label>
                        <textarea
                          value={interactionNotes}
                          onChange={e => setInteractionNotes(e.target.value)}
                          rows={2}
                          placeholder="Anything else worth noting…"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                        />
                      </div>

                      {/* Schedule follow-up */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleFollowUp}
                          onChange={e => setScheduleFollowUp(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-indigo-500"
                        />
                        <span className="text-xs text-gray-300">Schedule a follow-up task</span>
                      </label>

                      {scheduleFollowUp && (
                        <div className="space-y-3 pt-1 border-t border-gray-700">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Task Title</label>
                            <input
                              type="text"
                              value={followUpTitle}
                              onChange={e => setFollowUpTitle(e.target.value)}
                              placeholder="Follow up call with Jane Smith"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-1.5">Task Type</label>
                              <select
                                value={followUpType}
                                onChange={e => setFollowUpType(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                              >
                                {FOLLOWUP_TYPES.map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-1.5">Due Date</label>
                              <input
                                type="date"
                                value={followUpDueAt}
                                onChange={e => setFollowUpDueAt(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 pb-5 pt-3 border-t border-gray-800 shrink-0">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submit(false)}
                    disabled={saving || !companyName.trim()}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Create Prospect
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
