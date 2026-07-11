import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AnnouncementDetailClient } from "@/components/communications/announcement-detail-client"

export const dynamic = "force-dynamic"

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params

  const announcement = await prisma.announcement.findFirst({
    where: { id, orgId: session.organizationId },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      acknowledgments: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { acknowledgedAt: "asc" },
      },
    },
  })

  if (!announcement) notFound()

  const userAcked = announcement.acknowledgments.some(a => a.userId === session.userId)
  const isManager = ["ADMIN", "MANAGER"].includes(session.role)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <Link href="/communications/announcements" className="hover:text-gray-700 dark:hover:text-gray-300">Announcements</Link>
        <span>/</span>
        <span className="truncate text-gray-900 dark:text-white">{announcement.title}</span>
      </div>
      <AnnouncementDetailClient
        announcement={announcement as never}
        userAcked={userAcked}
        isManager={isManager}
      />
    </div>
  )
}
