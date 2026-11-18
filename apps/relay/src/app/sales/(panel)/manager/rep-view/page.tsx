import { redirect } from "next/navigation"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Users, ChevronRight, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

function timeAgo(date: Date | null): string {
  if (!date) return "Never"
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default async function RepViewPickerPage() {
  const session = await getSalesSession()
  if (!session?.isManager) redirect("/sales")

  const where = session.isSuperAdmin
    ? { role: "sales_rep", isActive: true }
    : { role: "sales_rep", isActive: true, managerId: session.salesUserId }

  const reps = await prisma.salesUser.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      sessions: {
        orderBy: { loginAt: "desc" },
        take: 1,
        select: { lastActivityAt: true, loginAt: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">View Rep Workspace</h1>
        <p className="text-sm text-gray-400 mt-1">
          Select a representative to inspect their CRM workspace in read-only mode.
        </p>
      </div>

      {reps.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {session.isSuperAdmin
              ? "No active sales representatives found."
              : "No representatives are assigned to you yet. Contact your super-admin to assign reps."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {reps.map(rep => {
            const lastActive = rep.sessions[0]?.lastActivityAt ?? rep.sessions[0]?.loginAt ?? null
            return (
              <Link
                key={rep.id}
                href={`/sales/manager/rep-view/${rep.id}`}
                className="flex items-center gap-4 px-5 py-4 bg-gray-900/40 hover:bg-gray-800/60 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 text-sm font-semibold">
                    {rep.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{rep.name}</p>
                  <p className="text-xs text-gray-500 truncate">{rep.email}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(lastActive ? new Date(lastActive) : null)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
