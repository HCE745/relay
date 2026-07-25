import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from "date-fns"
import { AlertCircle, Clock, Mail, CheckCircle, Building2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function FollowUpsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const now = new Date()

  const emails = await prisma.crmEmail.findMany({
    where: {
      followUpDate:   { not: null },
      followUpDoneAt: null,
      isDeleted:      false,
    },
    orderBy: { followUpDate: "asc" },
    select: {
      id:           true,
      contactEmail: true,
      subject:      true,
      sentAt:       true,
      followUpDate: true,
      demoCallId:   true,
      demoCall: {
        select: {
          id:          true,
          contactName: true,
          companyName: true,
        },
      },
    },
  })

  const overdue   = emails.filter(e => e.followUpDate! < now)
  const dueToday  = emails.filter(e => isToday(e.followUpDate!))
  const upcoming  = emails.filter(e => !isPast(e.followUpDate!) && !isToday(e.followUpDate!))

  function EmailCard({ email, urgency }: { email: typeof emails[0]; urgency: "overdue" | "today" | "upcoming" }) {
    const colors = {
      overdue:  { bg: "bg-red-950/30 border-red-900/50", badge: "bg-red-900/60 text-red-300", icon: "text-red-400" },
      today:    { bg: "bg-orange-950/30 border-orange-900/50", badge: "bg-orange-900/60 text-orange-300", icon: "text-orange-400" },
      upcoming: { bg: "bg-gray-900 border-gray-800", badge: "bg-gray-800 text-gray-400", icon: "text-gray-400" },
    }
    const c = colors[urgency]

    return (
      <div className={`border rounded-xl p-4 ${c.bg}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {urgency === "overdue" && <AlertCircle className={`w-4 h-4 shrink-0 ${c.icon}`} />}
              {urgency === "today"   && <Clock        className={`w-4 h-4 shrink-0 ${c.icon}`} />}
              {urgency === "upcoming"&& <Clock        className={`w-4 h-4 shrink-0 ${c.icon}`} />}
              <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
              {email.demoCall ? (
                <>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {email.demoCall.companyName}
                  </span>
                  <span>{email.demoCall.contactName}</span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {email.contactEmail}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                {urgency === "overdue"  ? `Overdue — due ${formatDistanceToNow(email.followUpDate!, { addSuffix: true })}` :
                 urgency === "today"    ? "Due today" :
                 isTomorrow(email.followUpDate!) ? "Due tomorrow" :
                 `Due ${format(email.followUpDate!, "MMM d")}`}
              </span>
              <span className="text-gray-600">Sent {formatDistanceToNow(email.sentAt, { addSuffix: true })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {email.demoCallId && (
              <Link
                href={`/super-admin/crm/demo-calls/${email.demoCallId}?compose=true&replyTo=${email.id}`}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Compose Follow-Up
              </Link>
            )}
            <Link
              href={`/super-admin/crm/demo-calls/${email.demoCallId ?? ""}`}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const total = emails.length

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Follow-Ups</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {total === 0 ? "No pending follow-ups" : `${total} pending follow-up${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {total === 0 && (
        <div className="text-center py-20">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <p className="text-gray-400">All caught up! No follow-ups pending.</p>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Overdue ({overdue.length})
          </h2>
          <div className="space-y-3">
            {overdue.map(e => <EmailCard key={e.id} email={e} urgency="overdue" />)}
          </div>
        </section>
      )}

      {dueToday.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Due Today ({dueToday.length})
          </h2>
          <div className="space-y-3">
            {dueToday.map(e => <EmailCard key={e.id} email={e} urgency="today" />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(e => <EmailCard key={e.id} email={e} urgency="upcoming" />)}
          </div>
        </section>
      )}
    </div>
  )
}
