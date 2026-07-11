import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { AssignmentForm } from "@/components/assignments/assignment-form"

export const dynamic = "force-dynamic"

export default async function NewAssignmentPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canCreate) redirect("/assignments")

  const [users, issues, assets, vendors, sops] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.issue.findMany({
      where: { organizationId: session.organizationId, status: { notIn: ["closed", "resolved"] } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.asset.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.sOP.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 50,
    }),
  ])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Assignment</h1>
      <AssignmentForm users={users} issues={issues} assets={assets} vendors={vendors} sops={sops} />
    </div>
  )
}
