import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Bell, AlertCircle, CheckCircle, ChevronUp } from "lucide-react"

const iconMap: Record<string, React.ReactNode> = {
  ISSUE_CREATED: <AlertCircle className="w-4 h-4 text-blue-500" />,
  ISSUE_ASSIGNED: <AlertCircle className="w-4 h-4 text-purple-500" />,
  ISSUE_UPDATED: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  ISSUE_ESCALATED: <ChevronUp className="w-4 h-4 text-red-500" />,
  ISSUE_RESOLVED: <CheckCircle className="w-4 h-4 text-green-500" />,
}

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { issue: { select: { id: true, title: true } } },
  })

  const unread = notifications.filter((n) => !n.isRead).length

  return (
    <div>
      <Header title={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`} />

      {/* Mobile page title */}
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">
          Notifications{unread > 0 ? <span className="ml-2 text-base font-semibold text-blue-600">({unread})</span> : ""}
        </h1>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-5 py-4 ${!n.isRead ? "bg-blue-50/50" : ""}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {iconMap[n.type] ?? <Bell className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                    {n.issue && (
                      <Link
                        href={`/issues/${n.issue.id}`}
                        className="text-xs text-blue-600 hover:underline mt-1 block"
                      >
                        View issue: {n.issue.title}
                      </Link>
                    )}
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
