import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Search, Building2, ExternalLink, Star } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  researched:       { text: "text-blue-400",    bg: "bg-blue-900/30"    },
  outreach_sent:    { text: "text-indigo-400",  bg: "bg-indigo-900/30"  },
  replied:          { text: "text-emerald-400", bg: "bg-emerald-900/30" },
  meeting_booked:   { text: "text-green-400",   bg: "bg-green-900/30"   },
  not_interested:   { text: "text-gray-500",    bg: "bg-gray-800/60"    },
  converted_to_crm: { text: "text-purple-400",  bg: "bg-purple-900/30"  },
}

export default async function ProspectsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const prospects = await prisma.prospect.findMany({
    orderBy:  [{ aiFitScore: "desc" }, { createdAt: "desc" }],
    take:     100,
    select: {
      id:                    true,
      companyName:           true,
      website:               true,
      industry:              true,
      headquartersCity:      true,
      headquartersState:     true,
      aiFitScore:            true,
      currentCrmStatus:      true,
      researchSummary:       true,
      lastOutreachDate:      true,
      createdAt:             true,
      contacts: {
        take: 1,
        select: { name: true, title: true, email: true },
      },
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-gray-400 text-sm mt-0.5">{prospects.length} prospects in database</p>
        </div>
        <Link
          href="/super-admin/crm/prospects"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Full Prospects DB
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Industry</th>
                <th className="text-left px-4 py-3 font-medium">AI Fit</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last Outreach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {prospects.map(p => {
                const style = STATUS_STYLES[p.currentCrmStatus] ?? { text: "text-gray-400", bg: "bg-gray-800/60" }
                const contact = p.contacts[0]
                return (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-4 py-3">
                      <Link href={`/sales/outreach/prospects/${p.id}`} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center shrink-0">
                          <Building2 className="w-3 h-3 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                            {p.companyName}
                          </p>
                          {p.website && (
                            <p className="text-xs text-gray-600">{p.website.replace(/^https?:\/\//, "")}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {contact ? (
                        <>
                          <p className="text-gray-300">{contact.name}</p>
                          <p className="text-xs text-gray-600">{contact.title ?? ""}</p>
                        </>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.industry ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.aiFitScore != null ? (
                        <div className="flex items-center gap-1">
                          <Star className={`w-3.5 h-3.5 ${p.aiFitScore >= 80 ? "text-yellow-400" : "text-gray-600"}`} />
                          <span className={`text-sm font-semibold ${p.aiFitScore >= 80 ? "text-yellow-400" : "text-gray-400"}`}>
                            {p.aiFitScore}
                          </span>
                        </div>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {p.currentCrmStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.lastOutreachDate
                        ? formatDistanceToNow(p.lastOutreachDate, { addSuffix: true })
                        : "Never"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {prospects.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No prospects yet</p>
            <Link href="/super-admin/crm/prospects" className="text-xs text-emerald-500 hover:text-emerald-400 mt-1 block">
              Add via CRM
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
