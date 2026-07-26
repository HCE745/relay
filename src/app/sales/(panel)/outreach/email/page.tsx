import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { EmailList } from "./email-list"

export const dynamic = "force-dynamic"

export default async function EmailPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const [sent, received] = await Promise.all([
    prisma.crmEmail.findMany({
      where:   { direction: "sent", isDeleted: false },
      orderBy: { sentAt: "desc" },
      take:    200,
      select: {
        id: true, contactEmail: true, subject: true, sentAt: true,
        followUpDate: true, followUpDoneAt: true,
        demoCall: { select: { id: true, companyName: true, contactName: true } },
      },
    }),
    prisma.crmEmail.findMany({
      where:   { direction: "received", isDeleted: false, isRead: false },
      orderBy: { sentAt: "desc" },
      take:    50,
      select: {
        id: true, fromAddress: true, subject: true, sentAt: true, contactEmail: true,
        demoCall: { select: { id: true, companyName: true, contactName: true } },
      },
    }),
  ])

  // Serialize dates as strings for client component
  const sentSerialized = sent.map(e => ({
    ...e,
    sentAt:        e.sentAt.toISOString(),
    followUpDate:  e.followUpDate?.toISOString() ?? null,
    followUpDoneAt:e.followUpDoneAt?.toISOString() ?? null,
  }))

  const receivedSerialized = received.map(e => ({
    ...e,
    sentAt:        e.sentAt.toISOString(),
    followUpDate:  null,
    followUpDoneAt:null,
  }))

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {received.length > 0 ? `${received.length} unread` : "All caught up"} · {sent.length} sent
          </p>
        </div>
        <Link
          href="/super-admin/crm"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in CRM
        </Link>
      </div>

      <EmailList sent={sentSerialized} received={receivedSerialized} />
    </div>
  )
}
