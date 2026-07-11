import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { EmergencyPageClient } from "@/components/communications/emergency-page-client"

export const dynamic = "force-dynamic"

export default async function EmergencyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const sp = await searchParams
  const showCreate = sp.create === "1" && ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)

  const broadcasts = await prisma.emergencyBroadcast.findMany({
    where: { orgId: session.organizationId },
    include: {
      createdBy:  { select: { id: true, name: true, role: true } },
      resolvedBy: { select: { id: true, name: true } },
      acknowledgments: {
        where: { userId: session.userId },
        select: { userId: true, acknowledgedAt: true },
      },
      _count: { select: { acknowledgments: true } },
    },
    orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
  })

  const canCreate  = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  const canResolve = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  const userId     = session.userId

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/communications" className="hover:text-gray-700 dark:hover:text-gray-300">Communications</Link>
        <span>/</span>
        <span>Emergency Broadcasts</span>
      </div>

      <EmergencyPageClient
        broadcasts={broadcasts as never}
        userId={userId}
        canCreate={canCreate}
        canResolve={canResolve}
        showCreate={showCreate}
      />
    </div>
  )
}
