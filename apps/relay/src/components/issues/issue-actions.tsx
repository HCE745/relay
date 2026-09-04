"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ISSUE_STATUS, ISSUE_PRIORITY } from "@/lib/constants"
import { ChevronUp, Edit3, Check, X } from "lucide-react"
import { toast } from "@/lib/toast"
import { PeoplePicker } from "@/components/ui/people-picker"
import type { Person } from "@/components/ui/people-picker"

interface Issue {
  id: string
  status: string
  priority: string
  assignedToId: string | null
  vendorId: string | null
  escalationLevel: number
  resolvedMethod: string | null
  resolutionCost: number | null
  rootCause: string | null
  timeToResolve: string | null
  resolutionCategory: string | null
  sopId: string | null
  sopComplianceOutcome: string | null
}

interface Props {
  issue: Issue
  users: Person[]
  vendors: Array<{ id: string; name: string }>
  sessionRole: string
}

const TIME_TO_RESOLVE_OPTIONS = [
  { value: "under_1_hour", label: "Under 1 hour" },
  { value: "1_4_hours", label: "1–4 hours" },
  { value: "4_8_hours", label: "4–8 hours" },
  { value: "1_2_days", label: "1–2 days" },
  { value: "3_5_days", label: "3–5 days" },
  { value: "1_plus_weeks", label: "1+ weeks" },
]

const RESOLUTION_CATEGORY_OPTIONS = [
  "Repaired",
  "Replaced",
  "Adjusted/Calibrated",
  "Training/Process Fix",
  "Vendor Resolved",
  "Temporary Fix",
  "Other",
]

const INPUT_CLASS = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const TEXTAREA_CLASS = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"

export function IssueActions({ issue, users, vendors, sessionRole }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [escalateReason, setEscalateReason] = useState("")

  const [status, setStatus] = useState(issue.status)
  const [priority, setPriority] = useState(issue.priority)
  const [assignedToId, setAssignedToId] = useState(issue.assignedToId ?? "")
  const [vendorId, setVendorId] = useState(issue.vendorId ?? "")
  const [resolvedMethod, setResolvedMethod] = useState(issue.resolvedMethod ?? "")
  const [resolutionCost, setResolutionCost] = useState(issue.resolutionCost?.toString() ?? "")
  const [rootCause, setRootCause] = useState(issue.rootCause ?? "")
  const [timeToResolve, setTimeToResolve] = useState(issue.timeToResolve ?? "")
  const [resolutionCategory, setResolutionCategory] = useState(issue.resolutionCategory ?? "")
  const [sopComplianceOutcome, setSopComplianceOutcome] = useState(issue.sopComplianceOutcome ?? "")

  async function handleSave() {
    setLoading(true)
    try {
    const res = await fetch(`/api/issues/${issue.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        priority,
        assignedToId: assignedToId || null,
        vendorId: vendorId || null,
        resolvedMethod: status === "RESOLVED" ? (resolvedMethod || null) : undefined,
        rootCause: status === "RESOLVED" ? (rootCause || null) : undefined,
        timeToResolve: status === "RESOLVED" ? (timeToResolve || null) : undefined,
        resolutionCategory: status === "RESOLVED" ? (resolutionCategory || null) : undefined,
        resolutionCost: status === "RESOLVED" && resolutionCost ? parseFloat(resolutionCost) : undefined,
        sopComplianceOutcome: status === "RESOLVED" && issue.sopId ? (sopComplianceOutcome || null) : undefined,
      }),
    })
    if (res.ok) {
      setEditing(false)
      router.refresh()
    } else {
      toast.error("Failed to save changes. Please try again.")
    }
    } catch {
      toast.error("Connection error — please check your internet and try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleEscalate() {
    setLoading(true)
    try {
    const res = await fetch(`/api/issues/${issue.id}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: escalateReason }),
    })
    if (res.ok) {
      setEscalating(false)
      setEscalateReason("")
      router.refresh()
    } else {
      toast.error("Failed to escalate issue. Please try again.")
    }
    } catch {
      toast.error("Connection error — please check your internet and try again.")
    } finally {
      setLoading(false)
    }
  }

  if (escalating) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 w-72">
        <h4 className="font-medium text-orange-800 mb-2 text-sm">Escalate Issue</h4>
        <textarea
          value={escalateReason}
          onChange={(e) => setEscalateReason(e.target.value)}
          placeholder="Reason for escalation…"
          rows={3}
          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setEscalating(false)}
            className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleEscalate}
            disabled={loading}
            className="flex-1 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-60"
          >
            {loading ? "…" : "Escalate"}
          </button>
        </div>
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => setEscalating(true)}
          className="flex items-center gap-1.5 px-3 py-2 border border-orange-300 text-orange-700 rounded-lg text-sm hover:bg-orange-50 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          Escalate
        </button>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 w-72 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={INPUT_CLASS}
        >
          {Object.entries(ISSUE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={INPUT_CLASS}
        >
          {Object.entries(ISSUE_PRIORITY).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
        <PeoplePicker
          people={users}
          value={assignedToId}
          onChange={setAssignedToId}
          placeholder="Search by name, role, department…"
          emptyLabel="Unassigned"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">No vendor</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Resolution capture — only when resolving */}
      {status === "RESOLVED" && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
            Help improve future AI suggestions — fill in what you can, or leave blank.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Root Cause</label>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="e.g. Worn motor bearings caused overheating…"
              rows={2}
              className={TEXTAREA_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Solution / Action Taken</label>
            <textarea
              value={resolvedMethod}
              onChange={(e) => setResolvedMethod(e.target.value)}
              placeholder="e.g. Replaced bearings, lubricated assembly…"
              rows={2}
              className={TEXTAREA_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Time to Resolve</label>
            <select
              value={timeToResolve}
              onChange={(e) => setTimeToResolve(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">— select —</option>
              {TIME_TO_RESOLVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resolution Category</label>
            <select
              value={resolutionCategory}
              onChange={(e) => setResolutionCategory(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">— select —</option>
              {RESOLUTION_CATEGORY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Cost (USD, optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={resolutionCost}
              onChange={(e) => setResolutionCost(e.target.value)}
              placeholder="e.g. 240"
              className={INPUT_CLASS}
            />
          </div>
          {issue.sopId && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SOP Compliance Outcome</label>
              <select
                value={sopComplianceOutcome}
                onChange={(e) => setSopComplianceOutcome(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">— did the linked SOP apply? —</option>
                <option value="SOP_NON_COMPLIANCE">SOP Non-Compliance — procedure existed but wasn&apos;t followed</option>
                <option value="SOP_DEFICIENCY">SOP Deficiency — procedure was inadequate or missing steps</option>
                <option value="UNRELATED">Unrelated — this issue had nothing to do with the SOP</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setEditing(false)}
          className="flex-1 flex items-center justify-center gap-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          <Check className="w-3.5 h-3.5" /> {loading ? "…" : "Save"}
        </button>
      </div>
    </div>
  )
}
