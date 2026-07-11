import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Users, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // People who report to you (you are their supervisor/manager)
  const directReports = await prisma.user.findMany({
    where: {
      organizationId: session.organizationId,
      managerId:      session.userId,
      isActive:       true,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })

  // Your supervisor
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { managerId: true, manager: { select: { id: true, name: true, role: true } } },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <span>Team Channels</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Channels</h1>

      {me?.manager && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">My Manager</p>
          <Link
            href={`/team/${me.manager.id}`}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              {me.manager.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{me.manager.name}</p>
              <p className="text-xs text-gray-500 capitalize">{me.manager.role.toLowerCase()}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
          </Link>
        </div>
      )}

      {directReports.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Direct Reports ({directReports.length})
          </p>
          <div className="space-y-2">
            {directReports.map(u => (
              <Link
                key={u.id}
                href={`/team/${u.id}`}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{u.role.toLowerCase()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {directReports.length === 0 && !me?.manager && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No team channels yet</p>
          <p className="text-sm mt-1">Team channels are created automatically based on your reporting structure.</p>
        </div>
      )}
    </div>
  )
}
