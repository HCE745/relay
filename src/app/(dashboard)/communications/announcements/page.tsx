import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Plus, Megaphone, CheckCircle2, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  normal:    { label: "Normal",  cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  urgent:    { label: "Urgent",  cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  emergency: { label: "Emergency", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

export default async function AnnouncementsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const announcements = await prisma.announcement.findMany({
    where: {
      orgId: session.organizationId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      createdBy:   { select: { id: true, name: true } },
      acknowledgments: {
        where: { userId: session.userId },
        select: { userId: true },
      },
      _count: { select: { acknowledgments: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
            <span>/</span>
            <span>Announcements</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
        </div>
        {canCreate && (
          <Link
            href="/communications/announcements/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </Link>
        )}
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No announcements</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const acked    = a.acknowledgments.length > 0
            const priority = PRIORITY_LABEL[a.priority] ?? PRIORITY_LABEL.normal
            return (
              <Link
                key={a.id}
                href={`/communications/announcements/${a.id}`}
                className={cn(
                  "block bg-white dark:bg-gray-800 border rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group",
                  acked ? "border-gray-100 dark:border-gray-700" : "border-blue-200 dark:border-blue-700"
                )}
              >
                <div className="flex items-start gap-3">
                  {acked
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    : <AlertCircle  className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "font-semibold text-sm",
                        acked ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"
                      )}>
                        {a.title}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", priority.cls)}>
                        {priority.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                      <span>{a.createdBy.name}</span>
                      <span>·</span>
                      <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      {a.requiresAcknowledgment && (
                        <>
                          <span>·</span>
                          <span>{a._count.acknowledgments} ack&apos;d</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
