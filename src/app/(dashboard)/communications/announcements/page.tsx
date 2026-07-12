import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AnnouncementsListClient } from "@/components/communications/announcements-list-client"

export const dynamic = "force-dynamic"

export default async function AnnouncementsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const announcements = await prisma.announcement.findMany({
    where: {
      orgId: session.organizationId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      createdBy:       { select: { id: true, name: true } },
      acknowledgments: {
        where:  { userId: session.userId },
        select: { userId: true },
      },
      _count: { select: { acknowledgments: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <span>Announcements</span>
      </div>
      <AnnouncementsListClient
        announcements={announcements as never}
        canCreate={canCreate}
      />
    </div>
  )
}
