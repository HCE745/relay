"use client"

import { useRouter } from "next/navigation"
import { Building2, Users } from "lucide-react"

const STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  researched:     { text: "text-blue-400",    bg: "bg-blue-900/30"    },
  contacted:      { text: "text-indigo-400",  bg: "bg-indigo-900/30"  },
  replied:        { text: "text-emerald-400", bg: "bg-emerald-900/30" },
  demo_scheduled: { text: "text-green-400",   bg: "bg-green-900/30"   },
  trial:          { text: "text-purple-400",  bg: "bg-purple-900/30"  },
  customer:       { text: "text-teal-400",    bg: "bg-teal-900/30"    },
  not_interested: { text: "text-gray-500",    bg: "bg-gray-800/60"    },
  do_not_contact: { text: "text-red-400",     bg: "bg-red-900/30"     },
}

const STATUS_LABELS: Record<string, string> = {
  researched:     "Researched",
  contacted:      "Contacted",
  replied:        "Replied",
  demo_scheduled: "Demo Scheduled",
  trial:          "Trial",
  customer:       "Customer",
  not_interested: "Not Interested",
  do_not_contact: "Do Not Contact",
}

export interface ProspectRow {
  id: string
  companyName: string
  industry: string | null
  headquartersCity: string | null
  headquartersState: string | null
  currentCrmStatus: string
  duplicateFlag: boolean
  updatedAt: Date | string
  assignedTo: { id: string; name: string } | null
  contacts: { id: string; name: string; title: string | null; email: string | null; isPrimaryContact: boolean }[]
  opportunities: { id: string; stage: string; value: { toString(): string } | null }[]
  _count: { contacts: number; opportunities: number }
}

export function ProspectsTable({ prospects, isManager }: { prospects: ProspectRow[]; isManager: boolean }) {
  const router = useRouter()

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
          <th className="text-left px-4 py-3 font-medium">Prospect</th>
          <th className="text-left px-4 py-3 font-medium">Primary Contact</th>
          <th className="text-left px-4 py-3 font-medium">Status</th>
          <th className="text-left px-4 py-3 font-medium">Pipeline</th>
          <th className="text-left px-4 py-3 font-medium">Contacts</th>
          {isManager && <th className="text-left px-4 py-3 font-medium">Rep</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800/60">
        {prospects.map(p => {
          const primary = p.contacts.find(c => c.isPrimaryContact) ?? p.contacts[0]
          const opp     = p.opportunities[0]
          const style   = STATUS_STYLES[p.currentCrmStatus] ?? { text: "text-gray-400", bg: "bg-gray-800/60" }
          const href    = `/sales/prospects/${p.id}`
          return (
            <tr
              key={p.id}
              onClick={() => router.push(href)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") router.push(href) }}
              tabIndex={0}
              role="link"
              aria-label={`Open prospect: ${p.companyName}`}
              className="hover:bg-gray-800/30 transition-colors cursor-pointer group focus:outline-none focus:bg-gray-800/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-900/40 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                      {p.companyName}
                      {p.duplicateFlag && (
                        <span className="ml-1.5 text-[10px] text-amber-400 bg-amber-900/30 px-1 py-0.5 rounded">dup</span>
                      )}
                    </p>
                    {(p.industry || p.headquartersCity) && (
                      <p className="text-xs text-gray-600">
                        {[
                          p.industry,
                          p.headquartersCity && p.headquartersState
                            ? `${p.headquartersCity}, ${p.headquartersState}`
                            : p.headquartersCity,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {primary ? (
                  <div>
                    <p className="text-gray-200 text-sm">{primary.name}</p>
                    <p className="text-xs text-gray-600">{primary.title ?? primary.email}</p>
                  </div>
                ) : (
                  <span className="text-gray-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                  {STATUS_LABELS[p.currentCrmStatus] ?? p.currentCrmStatus}
                </span>
              </td>
              <td className="px-4 py-3">
                {opp ? (
                  <div>
                    <p className="text-gray-300 text-xs font-medium">{opp.stage}</p>
                    {opp.value && <p className="text-xs text-gray-600">${parseFloat(opp.value.toString()).toLocaleString()}</p>}
                  </div>
                ) : (
                  <span className="text-gray-600 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  {p._count.contacts}
                </span>
              </td>
              {isManager && (
                <td className="px-4 py-3 text-xs text-gray-500">{p.assignedTo?.name ?? "—"}</td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
