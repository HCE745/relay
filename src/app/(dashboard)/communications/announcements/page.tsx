import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { AnnouncementsListClient } from "@/components/communications/announcements-list-client"
import { getOrgWCFlags } from "@/lib/workforce-comms"

export const dynamic = "force-dynamic"

export default async function AnnouncementsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [announcements, wcFlags] = await Promise.all([
    prisma.announcement.findMany({
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
  }),
    getOrgWCFlags(session.organizationId),
  ])

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  return (
    <div>
      <Header title="Announcements" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
          <span>/</span>
          <span>Announcements</span>
        </div>
        <AnnouncementsListClient
          announcements={announcements as never}
          canCreate={canCreate}
          wcSearch={wcFlags?.wc_communication_search ?? false}
        />
      </div>
    </div>
  )
}
