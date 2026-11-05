import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import { CompanyHub } from "./CompanyHub"

export const dynamic = "force-dynamic"

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const { id } = await params

  const [company, salesUsers] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        contacts:   { orderBy: [{ isPrimaryContact: "desc" }, { isDecisionMaker: "desc" }, { createdAt: "asc" }] },
        notes:      { orderBy: { createdAt: "desc" }, take: 50 },
        opportunities: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            contact:    { select: { id: true, name: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        demoCalls: {
          include: { assignedTo: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        salesActivities: {
          include: {
            salesUser: { select: { id: true, name: true } },
            contact:   { select: { id: true, name: true } },
          },
          orderBy: { occurredAt: "desc" },
          take: 100,
        },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            contact:    { select: { id: true, name: true } },
          },
          orderBy: [{ completedAt: "asc" }, { priority: "desc" }, { dueAt: "asc" }],
        },
        emails: {
          select: {
            id: true, direction: true, subject: true, bodyText: true, bodyHtml: true,
            sentAt: true, fromAddress: true, toAddress: true,
            isRead: true, openedAt: true, openCount: true, sentiment: true,
            isArchived: true, isDeleted: true,
            contact: { select: { id: true, name: true } },
          },
          where: { isDeleted: false },
          orderBy: { sentAt: "desc" },
          take: 100,
        },
      },
    }),
    prisma.salesUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!company) notFound()

  const isManager = !!(session.superAdmin || session.salesUserRole === "admin_sales")

  return (
    <CompanyHub
      company={company as never}
      salesUsers={salesUsers}
      currentUserId={session.salesUserId ?? null}
      isManager={isManager}
    />
  )
}
