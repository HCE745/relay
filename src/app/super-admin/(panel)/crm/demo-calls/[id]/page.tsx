"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CrmDemoCallForm } from "@/components/super-admin/crm-demo-call-form"
import { CrmEmailThread } from "@/components/super-admin/crm-email-thread"
import { CrmEmailCompose } from "@/components/super-admin/crm-email-compose"
import { Mail } from "lucide-react"

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
  const [call,    setCall]    = useState<DemoCall | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [composing, setComposing] = useState(false)

  async function loadCall() {
    const res = await fetch(`/api/super-admin/crm/demo-calls/${id}`)
    if (!res.ok) { router.push("/super-admin/crm/demo-calls"); return }
    const data = await res.json() as { call: DemoCall }
    setCall(data.call)
    setLoading(false)
  }

  useEffect(() => { void loadCall() }, [id])

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
          <DetailRow label="Status"     value={call.callStatus} />
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
