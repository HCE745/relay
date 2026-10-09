import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, Building2, CheckCircle2, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DuplicateDismissButton } from "./DuplicateDismissButton"

export const dynamic = "force-dynamic"

const STATUS_STYLES: Record<string, string> = {
  researched:       "text-blue-400 bg-blue-900/30",
  outreach_sent:    "text-indigo-400 bg-indigo-900/30",
  replied:          "text-emerald-400 bg-emerald-900/30",
  meeting_booked:   "text-green-400 bg-green-900/30",
  not_interested:   "text-gray-500 bg-gray-800/60",
  converted_to_crm: "text-purple-400 bg-purple-900/30",
}

export default async function DuplicateAccountsPage() {
  const session = await getSession()
  if (!session?.superAdmin && session?.salesUserRole !== "admin_sales") redirect("/sales")

  const flagged = await prisma.prospect.findMany({
    where: { duplicateFlag: true },
    select: {
      id: true,
      companyName: true,
      website: true,
      assignedToName: true,
      currentCrmStatus: true,
      createdAt: true,
      duplicateOfId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  // Fetch the original records for side-by-side display
  const originalIds = flagged.map(p => p.duplicateOfId).filter(Boolean) as string[]
  const originals = await prisma.prospect.findMany({
    where: { id: { in: originalIds } },
    select: { id: true, companyName: true, assignedToName: true, currentCrmStatus: true, website: true },
  })
  const originalsMap = Object.fromEntries(originals.map(o => [o.id, o]))

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sales/manager" className="text-gray-500 hover:text-gray-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Duplicate Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {flagged.length} flagged {flagged.length === 1 ? "record" : "records"} awaiting review
          </p>
        </div>
      </div>

      {flagged.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No duplicate accounts flagged</p>
          <p className="text-sm text-gray-600 mt-1">All prospect accounts have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flagged.map(p => {
            const original = p.duplicateOfId ? originalsMap[p.duplicateOfId] : null
            const statusStyle = STATUS_STYLES[p.currentCrmStatus] ?? "text-gray-400 bg-gray-800/60"
            return (
              <div key={p.id} className="bg-gray-900 border border-amber-900/40 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Flagged duplicate</span>
                      <span className="text-xs text-gray-600 ml-auto">
                        {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* New (flagged) record */}
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <p className="text-xs text-amber-400 font-medium mb-2 uppercase tracking-wide">New record</p>
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <Link
                            href={`/sales/outreach/prospects/${p.id}`}
                            className="font-medium text-white hover:text-emerald-300 transition-colors flex items-center gap-1 text-sm"
                          >
                            {p.companyName}
                            <ExternalLink className="w-3 h-3 text-gray-600" />
                          </Link>
                        </div>
                        {p.website && <p className="text-xs text-gray-600 ml-5">{p.website}</p>}
                        <p className="text-xs text-gray-500 ml-5 mt-1">Owned by {p.assignedToName ?? "unassigned"}</p>
                        <span className={`mt-2 ml-5 inline-block text-xs px-2 py-0.5 rounded-full ${statusStyle}`}>
                          {p.currentCrmStatus.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Original (existing) record */}
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Existing record</p>
                        {original ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              <Link
                                href={`/sales/outreach/prospects/${original.id}`}
                                className="font-medium text-white hover:text-emerald-300 transition-colors flex items-center gap-1 text-sm"
                              >
                                {original.companyName}
                                <ExternalLink className="w-3 h-3 text-gray-600" />
                              </Link>
                            </div>
                            {original.website && <p className="text-xs text-gray-600 ml-5">{original.website}</p>}
                            <p className="text-xs text-gray-500 ml-5 mt-1">Owned by {original.assignedToName ?? "unassigned"}</p>
                            <span className={`mt-2 ml-5 inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[original.currentCrmStatus] ?? "text-gray-400 bg-gray-800/60"}`}>
                              {original.currentCrmStatus.replace(/_/g, " ")}
                            </span>
                          </>
                        ) : (
                          <p className="text-xs text-gray-600 ml-5">Original record not found or deleted</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <DuplicateDismissButton prospectId={p.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
