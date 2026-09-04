import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow, format } from "date-fns"
import { Building2, Calendar, Users } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  "Converted":      { text: "text-green-400",   bg: "bg-green-900/30" },
  "Trial Active":   { text: "text-emerald-400",  bg: "bg-emerald-900/30" },
  "Trial Expired":  { text: "text-orange-400",   bg: "bg-orange-900/30" },
  "Demo Completed": { text: "text-purple-400",   bg: "bg-purple-900/30" },
  "Scheduled":      { text: "text-indigo-400",   bg: "bg-indigo-900/30" },
  "New Lead":       { text: "text-blue-400",     bg: "bg-blue-900/30"  },
  "Pending":        { text: "text-yellow-400",   bg: "bg-yellow-900/30"},
  "Lost":           { text: "text-gray-500",     bg: "bg-gray-800/60"  },
}

export default async function LeadsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const calls = await prisma.demoCall.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      contactName:  true,
      contactEmail: true,
      companyName:  true,
      industry:     true,
      callStatus:   true,
      scheduledAt:  true,
      followUpDate: true,
      followUpCompleted: true,
      createdAt:    true,
      updatedAt:    true,
      leadSource:   true,
      crmEmails:    { select: { id: true }, where: { direction: "sent" } },
    },
  })

  const now = new Date()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-gray-400 text-sm mt-0.5">{calls.length} total leads</p>
        </div>
        <Link
          href="/super-admin/crm/demo-calls"
          className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Manage in CRM ↗
        </Link>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Industry</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Demo</th>
                <th className="text-left px-4 py-3 font-medium">Emails</th>
                <th className="text-left px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {calls.map(call => {
                const style = STATUS_STYLES[call.callStatus ?? ""] ?? { text: "text-gray-400", bg: "bg-gray-800/60" }
                const followUpOverdue = call.followUpDate && !call.followUpCompleted && call.followUpDate < now
                return (
                  <tr
                    key={call.id}
                    className="hover:bg-gray-800/40 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/crm/demo-calls/${call.id}`} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center shrink-0">
                          <Building2 className="w-3 h-3 text-gray-500" />
                        </div>
                        <span className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                          {call.companyName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300">{call.contactName}</p>
                      <p className="text-xs text-gray-600">{call.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{call.industry ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {call.callStatus ?? "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {call.scheduledAt ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(call.scheduledAt, "MMM d, yyyy")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {call.crmEmails.length > 0 ? (
                        <span className="flex items-center gap-1">
                          {call.crmEmails.length}
                          {followUpOverdue && <span className="text-orange-400 ml-1">⚡</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDistanceToNow(call.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {calls.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No leads yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
