"use client"

import { useRouter } from "next/navigation"
import { Building2 } from "lucide-react"

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STATUS_COLORS: Record<string, string> = {
  Scheduled:   "bg-blue-900/40 text-blue-300",
  Completed:   "bg-emerald-900/40 text-emerald-300",
  "No-Show":   "bg-red-900/40 text-red-300",
  Cancelled:   "bg-gray-800 text-gray-400",
  "Follow-Up": "bg-amber-900/40 text-amber-300",
}

export interface AccountRow {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  callStatus: string
  updatedAt: Date | string
  assignedTo: { id: string; name: string } | null
  organization: { id: string; name: string; subscriptionStatus: string | null; plan: string | null } | null
  opportunities: { id: string; stage: string; value: { toString(): string } | null }[]
  crmEmails: { createdAt: Date | string; direction: string }[]
  engagement: { score: number; label: string; color: string }
}

export function AccountsTable({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter()

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase tracking-wider">
          <th className="px-4 py-3 font-medium">Company</th>
          <th className="px-4 py-3 font-medium">Contact</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium">Open Deal</th>
          <th className="px-4 py-3 font-medium">Engagement</th>
          <th className="px-4 py-3 font-medium">Last Activity</th>
          <th className="px-4 py-3 font-medium">Rep</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800/60">
        {accounts.map(call => {
          const opp  = call.opportunities[0]
          const last = call.crmEmails[0]?.createdAt ?? call.updatedAt
          const href = `/sales/accounts/${call.id}`
          return (
            <tr
              key={call.id}
              onClick={() => router.push(href)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") router.push(href) }}
              tabIndex={0}
              role="link"
              aria-label={`Open account: ${call.companyName}`}
              className="hover:bg-gray-800/30 transition-colors cursor-pointer group focus:outline-none focus:bg-gray-800/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-white group-hover:text-indigo-300 transition-colors">{call.companyName}</p>
                    {call.organization && (
                      <p className="text-xs text-emerald-400">{call.organization.plan} · {call.organization.subscriptionStatus}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="text-white">{call.contactName}</p>
                <p className="text-gray-500 text-xs">{call.contactEmail}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[call.callStatus] ?? "bg-gray-800 text-gray-400"}`}>
                  {call.callStatus}
                </span>
              </td>
              <td className="px-4 py-3">
                {opp ? (
                  <span className="text-gray-300 text-xs">{opp.stage}</span>
                ) : (
                  <span className="text-gray-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${call.engagement.color}`}>{call.engagement.label}</span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(last)}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{call.assignedTo?.name ?? "—"}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
