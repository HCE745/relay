import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Mail, Inbox, Send, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function EmailPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const [sent, received] = await Promise.all([
    prisma.crmEmail.findMany({
      where:   { direction: "sent", isDeleted: false },
      orderBy: { sentAt: "desc" },
      take:    50,
      select: {
        id: true, contactEmail: true, subject: true, sentAt: true,
        followUpDate: true, followUpDoneAt: true,
        demoCall: { select: { id: true, companyName: true, contactName: true } },
      },
    }),
    prisma.crmEmail.findMany({
      where:   { direction: "received", isDeleted: false, isRead: false },
      orderBy: { sentAt: "desc" },
      take:    20,
      select: {
        id: true, fromAddress: true, subject: true, sentAt: true,
        demoCall: { select: { id: true, companyName: true, contactName: true } },
      },
    }),
  ])

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

      {/* Unread section */}
      {received.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Unread ({received.length})
          </h2>
          <div className="space-y-2">
            {received.map(email => (
              <Link
                key={email.id}
                href={email.demoCall ? `/super-admin/crm/demo-calls/${email.demoCall.id}` : "/super-admin/crm"}
                className="block bg-gray-900 border border-blue-900/40 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                    </div>
                    <p className="text-xs text-gray-400 ml-4">{email.fromAddress}</p>
                    {email.demoCall && (
                      <p className="text-xs text-gray-600 ml-4 mt-0.5">{email.demoCall.companyName} · {email.demoCall.contactName}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatDistanceToNow(email.sentAt, { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sent section */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Send className="w-4 h-4" />
          Sent ({sent.length})
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800/60">
            {sent.map(email => {
              const followUpDue = email.followUpDate && !email.followUpDoneAt && email.followUpDate < new Date()
              return (
                <Link
                  key={email.id}
                  href={email.demoCall ? `/super-admin/crm/demo-calls/${email.demoCall.id}` : "/super-admin/crm"}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/40 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{email.subject}</p>
                    {email.demoCall && (
                      <p className="text-xs text-gray-500 truncate">
                        {email.demoCall.companyName} · {email.contactEmail}
                      </p>
                    )}
                  </div>
                  {followUpDue && (
                    <span className="text-xs text-orange-400 font-medium shrink-0">Follow-up due</span>
                  )}
                  <span className="text-xs text-gray-600 shrink-0">
                    {formatDistanceToNow(email.sentAt, { addSuffix: true })}
                  </span>
                </Link>
              )
            })}
          </div>
          {sent.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">No sent emails</div>
          )}
        </div>
      </section>
    </div>
  )
}
