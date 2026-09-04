import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ClipboardList, AlertTriangle, Calendar, Clock, Inbox,
  Mail, Pause, CheckCircle2, Send, RefreshCw, Settings,
} from "lucide-react"
import { FollowUpCard, type FollowUpData } from "@/components/crm/follow-up-card"
import { EnrollmentCard, type EnrollmentCardData } from "@/components/crm/enrollment-card"

export const dynamic = "force-dynamic"

const demoCallSelect = {
  id: true, contactName: true, contactEmail: true, companyName: true,
  contactRole: true, callStatus: true,
  organization: { select: { id: true, name: true, lifecycleStatus: true } },
} as const

const followUpInclude = {
  enrollment: {
    include: {
      sequence: { select: { id: true, name: true } },
      demoCall: { select: demoCallSelect },
    },
  },
} as const

const enrollmentInclude = {
  sequence: { select: { id: true, name: true } },
  demoCall: { select: demoCallSelect },
} as const

function SectionHeader({
  title,
  count,
  icon: Icon,
  variant = "default",
}: {
  title: string
  count: number
  icon: React.ElementType
  variant?: "default" | "danger" | "warning" | "primary" | "blue"
}) {
  const textColor = {
    default: "text-gray-300",
    danger:  "text-red-400",
    warning: "text-yellow-400",
    primary: "text-indigo-400",
    blue:    "text-blue-400",
  }[variant]
  const badgeColor = {
    default: "bg-gray-700 text-gray-300",
    danger:  "bg-red-900/60 text-red-300",
    warning: "bg-yellow-900/60 text-yellow-300",
    primary: "bg-indigo-900/60 text-indigo-300",
    blue:    "bg-blue-900/60 text-blue-300",
  }[variant]
  return (
    <div className="flex items-center gap-3 mb-3">
      <Icon className={`w-5 h-5 ${textColor}`} />
      <h2 className={`font-semibold text-base ${textColor}`}>{title}</h2>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium tabular-nums ${badgeColor}`}>
        {count}
      </span>
    </div>
  )
}

export default async function FollowUpsQueuePage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    draftedForReview,
    overdue,
    dueToday,
    scheduledToSend,
    upcoming,
    waitingEnrollments,
    pausedEnrollments,
    completedEnrollments,
  ] = await Promise.all([
    // Drafted for review (draft_generated) — highest priority
    prisma.crmFollowUp.findMany({
      where:   { status: "draft_generated", enrollment: { status: "active" } },
      include: followUpInclude,
      orderBy: { scheduledFor: "asc" },
    }),

    // Overdue pending follow-ups
    prisma.crmFollowUp.findMany({
      where:   { status: "pending", scheduledFor: { lt: todayStart }, enrollment: { status: "active" } },
      include: followUpInclude,
      orderBy: { scheduledFor: "asc" },
    }),

    // Due today (pending)
    prisma.crmFollowUp.findMany({
      where:   { status: "pending", scheduledFor: { gte: todayStart, lt: todayEnd }, enrollment: { status: "active" } },
      include: followUpInclude,
      orderBy: { scheduledFor: "asc" },
    }),

    // Approved / auto-send queue
    prisma.crmFollowUp.findMany({
      where:   { status: "approved", enrollment: { status: "active" } },
      include: followUpInclude,
      orderBy: { scheduledFor: "asc" },
    }),

    // Upcoming (next 30 days, pending)
    prisma.crmFollowUp.findMany({
      where: {
        status:       "pending",
        scheduledFor: { gte: todayEnd, lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        enrollment:   { status: "active" },
      },
      include: followUpInclude,
      orderBy: { scheduledFor: "asc" },
      take:    50,
    }),

    // Waiting for reply: active enrollments with no pending/drafted/approved follow-ups
    prisma.crmEmailSequenceEnrollment.findMany({
      where: {
        status:    "active",
        followUps: { none: { status: { in: ["pending", "draft_generated", "approved"] } } },
      },
      include: {
        ...enrollmentInclude,
        followUps: {
          where:   { status: "sent" },
          orderBy: { sentAt: "desc" },
          take:    1,
          select:  { sentAt: true, stepNumber: true },
        },
      },
      orderBy: { lastContactAt: "asc" },
      take:    100,
    }),

    // Paused enrollments
    prisma.crmEmailSequenceEnrollment.findMany({
      where:   { status: "paused" },
      include: enrollmentInclude,
      orderBy: { updatedAt: "desc" },
      take:    50,
    }),

    // Completed/stopped in last 30 days
    prisma.crmEmailSequenceEnrollment.findMany({
      where: {
        status:    { in: ["completed", "stopped"] },
        stoppedAt: { gte: thirtyDaysAgo },
      },
      include: {
        ...enrollmentInclude,
        followUps: {
          where:   { status: "sent" },
          orderBy: { sentAt: "desc" },
          take:    1,
          select:  { sentAt: true, stepNumber: true },
        },
      },
      orderBy: { stoppedAt: "desc" },
      take:    30,
    }),
  ])

  const totalActionable = draftedForReview.length + overdue.length + dueToday.length

  // Serialize for client components (Prisma returns Dates, Next.js serializes to ISO strings)
  const toFollowUp = (f: typeof draftedForReview[0]): FollowUpData => ({
    id:           f.id,
    stepNumber:   f.stepNumber,
    status:       f.status,
    scheduledFor: (f.scheduledFor ?? new Date()).toISOString(),
    draftSubject:   f.draftSubject,
    draftBodyHtml:  f.draftBodyHtml,
    draftBodyText:  f.draftBodyText,
    aiGeneratedAt:  f.aiGeneratedAt?.toISOString() ?? null,
    errorLog:       f.errorLog,
    enrollment: {
      id:           f.enrollment.id,
      currentStep:  f.enrollment.currentStep,
      status:       f.enrollment.status,
      mode:         f.enrollment.mode,
      enrolledAt:   f.enrollment.enrolledAt.toISOString(),
      lastContactAt: f.enrollment.lastContactAt?.toISOString() ?? null,
      sequence: f.enrollment.sequence,
      demoCall: {
        ...f.enrollment.demoCall,
        organization: f.enrollment.demoCall.organization ?? null,
      },
    },
  })

  type EnrollmentInput = {
    id: string; status: string; stopReason: string | null; stoppedAt: Date | null
    enrolledAt: Date; lastContactAt: Date | null; currentStep: number
    sequence: { id: string; name: string }
    demoCall: {
      id: string; contactName: string; contactEmail: string; companyName: string | null
      contactRole: string | null; callStatus: string
      organization: { id: string; name: string; lifecycleStatus: string } | null
    }
    followUps?: { sentAt: Date | null; stepNumber: number }[]
  }
  const toEnrollment = (e: EnrollmentInput): EnrollmentCardData => ({
    id:           e.id,
    status:       e.status,
    stopReason:   e.stopReason,
    stoppedAt:    e.stoppedAt?.toISOString() ?? null,
    enrolledAt:   e.enrolledAt.toISOString(),
    lastContactAt: e.lastContactAt?.toISOString() ?? null,
    currentStep:  e.currentStep,
    sequence:     e.sequence,
    demoCall: {
      ...e.demoCall,
      organization: e.demoCall.organization ?? null,
    },
    followUps: "followUps" in e
      ? (e.followUps as { sentAt: Date | null; stepNumber: number }[]).map(f => ({
          sentAt:     f.sentAt?.toISOString() ?? null,
          stepNumber: f.stepNumber,
        }))
      : undefined,
  })

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Follow-Up Queue</h1>
          </div>
          <p className="text-gray-400 text-sm">
            {totalActionable > 0
              ? `${totalActionable} item${totalActionable !== 1 ? "s" : ""} need your attention today`
              : "All caught up — no action needed today"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/super-admin/crm/settings"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors border border-gray-700"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Summary bar */}
      {(draftedForReview.length + overdue.length + dueToday.length + scheduledToSend.length + upcoming.length) === 0 &&
       waitingEnrollments.length === 0 && pausedEnrollments.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-lg">Queue is empty</p>
          <p className="text-gray-400 text-sm mt-1">
            No active follow-up sequences. Send an email from the{" "}
            <Link href="/super-admin/crm/email" className="text-indigo-400 hover:text-indigo-300">
              CRM Email
            </Link>{" "}
            page to start a sequence.
          </p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Drafted for Review */}
          {draftedForReview.length > 0 && (
            <section>
              <SectionHeader title="Drafted for Review" count={draftedForReview.length} icon={Mail} variant="primary" />
              <div className="space-y-3">
                {draftedForReview.map(f => (
                  <FollowUpCard key={f.id} followUp={toFollowUp(f)} defaultExpanded={draftedForReview.length === 1} />
                ))}
              </div>
            </section>
          )}

          {/* Overdue */}
          {overdue.length > 0 && (
            <section>
              <SectionHeader title="Overdue" count={overdue.length} icon={AlertTriangle} variant="danger" />
              <div className="space-y-3">
                {overdue.map(f => (
                  <FollowUpCard key={f.id} followUp={toFollowUp(f)} />
                ))}
              </div>
            </section>
          )}

          {/* Due Today */}
          {dueToday.length > 0 && (
            <section>
              <SectionHeader title="Due Today" count={dueToday.length} icon={Calendar} variant="warning" />
              <div className="space-y-3">
                {dueToday.map(f => (
                  <FollowUpCard key={f.id} followUp={toFollowUp(f)} />
                ))}
              </div>
            </section>
          )}

          {/* Scheduled to Send (auto-send queue) */}
          {scheduledToSend.length > 0 && (
            <section>
              <SectionHeader title="Approved — Scheduled to Send" count={scheduledToSend.length} icon={Send} variant="blue" />
              <div className="space-y-3">
                {scheduledToSend.map(f => (
                  <FollowUpCard key={f.id} followUp={toFollowUp(f)} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <SectionHeader title="Upcoming (Next 30 Days)" count={upcoming.length} icon={Clock} />
              <div className="space-y-3">
                {upcoming.map(f => (
                  <FollowUpCard key={f.id} followUp={toFollowUp(f)} />
                ))}
              </div>
            </section>
          )}

          {/* Waiting for Reply */}
          {waitingEnrollments.length > 0 && (
            <section>
              <SectionHeader title="Waiting for Reply" count={waitingEnrollments.length} icon={Inbox} />
              <div className="space-y-3">
                {waitingEnrollments.map(e => (
                  <EnrollmentCard key={e.id} enrollment={toEnrollment(e)} type="waiting" />
                ))}
              </div>
            </section>
          )}

          {/* Paused */}
          {pausedEnrollments.length > 0 && (
            <section>
              <SectionHeader title="Paused" count={pausedEnrollments.length} icon={Pause} />
              <div className="space-y-3">
                {pausedEnrollments.map(e => (
                  <EnrollmentCard key={e.id} enrollment={toEnrollment(e)} type="paused" />
                ))}
              </div>
            </section>
          )}

          {/* Completed / Stopped (last 30 days) */}
          {completedEnrollments.length > 0 && (
            <section>
              <SectionHeader title="Completed — Last 30 Days" count={completedEnrollments.length} icon={CheckCircle2} />
              <div className="space-y-3">
                {completedEnrollments.map(e => (
                  <EnrollmentCard key={e.id} enrollment={toEnrollment(e)} type="completed" />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
