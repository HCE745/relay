"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CrmDemoCallForm } from "@/components/super-admin/crm-demo-call-form"
import { CrmEmailThread } from "@/components/super-admin/crm-email-thread"
import { CrmEmailCompose } from "@/components/super-admin/crm-email-compose"
import { Mail, Zap, ShieldOff, AlertTriangle, Download, Loader2, ChevronDown } from "lucide-react"

interface EngagementData {
  score: number
  label: "Low" | "Medium" | "High" | "Hot"
  openCount: number
  events: { eventType: string; createdAt: string; url: string | null }[]
  clicks: { url: string; clickCount: number; lastClickedAt: string | null }[]
}

interface DemoCall {
  id:               string
  contactName:      string
  contactEmail:     string
  contactPhone:     string | null
  companyName:      string
  industry:         string | null
  employeeCount:    number | null
  locationCount:    number | null
  leadSource:       string
  scheduledAt:      string | null
  callStatus:       string
  callNotes:        string | null
  painPoints:       string | null
  followUpDate:     string | null
  followUpCompleted: boolean
  outcome:          string | null
  organizationId:   string | null
  organization:     { id: string; name: string } | null
}

export default function DemoCallDetailPage() {
  const { id }  = useParams() as { id: string }
  const router  = useRouter()
  const [call,          setCall]          = useState<DemoCall | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [editing,       setEditing]       = useState(false)
  const [composing,     setComposing]     = useState(false)
  const [engagement,    setEngagement]    = useState<EngagementData | null>(null)
  const [exportOpen,    setExportOpen]    = useState(false)
  const [exporting,     setExporting]     = useState(false)

  async function exportEmails(format: "html" | "text") {
    if (!call) return
    setExporting(true)
    try {
      const res = await fetch("/api/sales/emails/export/account", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accountId: call.id, accountType: "demoCall", format }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: undefined })) as { error?: string }
        alert(`Export failed: ${d.error ?? res.status}`)
        return
      }
      const blob    = await res.blob()
      if (blob.size === 0) { alert("Export failed: empty response"); return }
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement("a")
      const cd      = res.headers.get("Content-Disposition") ?? ""
      const fnMatch = cd.match(/filename="([^"]+)"/)
      a.href        = url
      a.download    = fnMatch?.[1] ?? `email-export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportOpen(false)
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  async function loadCall() {
    const res = await fetch(`/api/super-admin/crm/demo-calls/${id}`)
    if (!res.ok) { router.push("/super-admin/crm/demo-calls"); return }
    const data = await res.json() as { call: DemoCall }
    setCall(data.call)
    setLoading(false)
  }

  useEffect(() => { void loadCall() }, [id])

  useEffect(() => {
    fetch(`/api/super-admin/crm/demo-calls/${id}/engagement`)
      .then(r => r.ok ? r.json() : null)
      .then((d: EngagementData | null) => { if (d) setEngagement(d) })
      .catch(() => {})
  }, [id])

  async function addSuppressionRecord(reason: "UNSUBSCRIBE" | "DO_NOT_CONTACT") {
    if (!call) return
    const label = reason === "UNSUBSCRIBE" ? "Unsubscribe" : "Do Not Contact"
    if (!confirm(`Mark ${call.contactEmail} as ${label}? They will be suppressed from all future outreach.`)) return
    const res = await fetch("/api/sales/unsubscribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:  call.contactEmail,
        reason,
        source: "MANUAL",
        notes:  `Added from DemoCall ${id}`,
      }),
    })
    if (res.ok) {
      alert(`${call.contactEmail} has been suppressed (${label}).`)
    } else {
      const d = await res.json()
      alert(d.error ?? "Failed to add suppression record.")
    }
  }

  async function markFollowUpComplete() {
    await fetch(`/api/super-admin/crm/demo-calls/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ followUpCompleted: true }),
    })
    void loadCall()
  }

  if (loading) return <p className="text-sm text-gray-400 p-6">Loading…</p>
  if (!call)   return null

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href="/super-admin/crm/demo-calls" className="text-sm text-blue-600 hover:underline">
          ← Demo Calls
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{call.contactName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{call.companyName} · {call.contactEmail}</p>
          {call.organization && (
            <Link href={`/super-admin/organizations/${call.organization.id}`}
              className="text-sm text-blue-600 hover:underline mt-1 inline-block">
              Linked org: {call.organization.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Export emails dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-emerald-600 hover:border-emerald-400 text-xs rounded-lg transition-colors"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Emails
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-44 overflow-hidden">
                <button
                  onClick={() => void exportEmails("html")}
                  disabled={exporting}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Download HTML (printable)
                </button>
                <button
                  onClick={() => void exportEmails("text")}
                  disabled={exporting}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Download as Text
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => addSuppressionRecord("UNSUBSCRIBE")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:border-red-400 text-xs rounded-lg transition-colors"
            title="Mark as unsubscribed — suppresses from all future outreach"
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Unsub
          </button>
          <button
            onClick={() => addSuppressionRecord("DO_NOT_CONTACT")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-red-700 hover:border-red-600 text-xs rounded-lg transition-colors"
            title="Mark as Do Not Contact — hard suppression for legal or relationship reasons"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            DNC
          </button>
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            Compose Email
          </button>
          <button
            onClick={() => setEditing(e => !e)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <CrmDemoCallForm
            initial={{
              id:             call.id,
              contactName:    call.contactName,
              contactEmail:   call.contactEmail,
              contactPhone:   call.contactPhone ?? "",
              companyName:    call.companyName,
              industry:       call.industry ?? "",
              employeeCount:  call.employeeCount?.toString() ?? "",
              locationCount:  call.locationCount?.toString() ?? "",
              leadSource:     call.leadSource,
              scheduledAt:    call.scheduledAt ? new Date(call.scheduledAt).toISOString().slice(0,16) : "",
              callStatus:     call.callStatus,
              callNotes:      call.callNotes ?? "",
              painPoints:     call.painPoints ?? "",
              followUpDate:   call.followUpDate ? new Date(call.followUpDate).toISOString().slice(0,10) : "",
              outcome:        call.outcome ?? "",
              organizationId: call.organizationId ?? "",
            }}
            onSuccess={() => { setEditing(false); void loadCall() }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
          <DetailRow label="Relationship Status" value={call.callStatus} />
          <DetailRow label="Lead Source" value={call.leadSource} />
          <DetailRow label="Scheduled"  value={call.scheduledAt ? new Date(call.scheduledAt).toLocaleString() : "—"} />
          <DetailRow label="Outcome"    value={call.outcome ?? "—"} />
          <DetailRow label="Industry"   value={call.industry ?? "—"} />
          <DetailRow label="Employees"  value={call.employeeCount?.toString() ?? "—"} />
          <DetailRow label="Locations"  value={call.locationCount?.toString() ?? "—"} />
          {call.followUpDate && (
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Follow-up</p>
                <p className="text-sm text-gray-900 dark:text-gray-200 mt-0.5">
                  {new Date(call.followUpDate).toLocaleDateString()}{" "}
                  {call.followUpCompleted ? "✓ Completed" : "⏳ Pending"}
                </p>
              </div>
              {!call.followUpCompleted && (
                <button onClick={markFollowUpComplete}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                  Mark Complete
                </button>
              )}
            </div>
          )}
          {call.painPoints && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Pain Points</p>
              <p className="text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap">{call.painPoints}</p>
            </div>
          )}
          {call.callNotes && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap">{call.callNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Engagement signals */}
      {engagement && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Engagement Signals</h2>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              engagement.label === "Hot"    ? "bg-red-100 text-red-700" :
              engagement.label === "High"   ? "bg-emerald-100 text-emerald-700" :
              engagement.label === "Medium" ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {engagement.label} · {engagement.score} pts
            </span>
          </div>

          <div className="flex gap-4 mb-4 text-center">
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg py-3">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{engagement.openCount}</p>
              <p className="text-[10px] text-gray-500 uppercase">Email Opens</p>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg py-3">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {engagement.clicks.reduce((s, c) => s + c.clickCount, 0)}
              </p>
              <p className="text-[10px] text-gray-500 uppercase">Link Clicks</p>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg py-3">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{engagement.events.length}</p>
              <p className="text-[10px] text-gray-500 uppercase">Events</p>
            </div>
          </div>

          {engagement.events.length > 0 && (
            <div className="space-y-1.5">
              {engagement.events.slice(0, 8).map((ev, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span className="font-medium capitalize">{ev.eventType.replace(/_/g, " ")}</span>
                  <span className="text-gray-400">{new Date(ev.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          {engagement.events.length === 0 && engagement.openCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">No engagement signals yet.</p>
          )}
        </div>
      )}

      {/* Email Thread */}
      <CrmEmailThread
        demoCall={{
          id:           call.id,
          contactName:  call.contactName,
          contactEmail: call.contactEmail,
          companyName:  call.companyName,
          scheduledAt:  call.scheduledAt,
        }}
      />

      {/* Compose modal (from top-level button) */}
      {composing && (
        <CrmEmailCompose
          demoCallId={call.id}
          toEmail={call.contactEmail}
          demoCtx={{ contactName: call.contactName, companyName: call.companyName, scheduledAt: call.scheduledAt }}
          onClose={() => setComposing(false)}
          onSent={() => setComposing(false)}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
      <p className="text-sm text-gray-900 dark:text-gray-200 mt-0.5">{value}</p>
    </div>
  )
}
