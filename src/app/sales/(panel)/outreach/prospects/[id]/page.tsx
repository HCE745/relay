import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import {
  Building2, Mail, User, Star, ArrowLeft, ExternalLink, Globe,
  MapPin, Users, Tag, Clock, Send, MessageSquare, Calendar,
  MousePointer, Zap, Eye, TrendingUp, CheckCircle2, Trophy,
} from "lucide-react"
import { computeEngagementScore, scoreLabel, scoreColor } from "@/lib/engagement-score"

export const dynamic = "force-dynamic"

const STATUS_COLORS: Record<string, string> = {
  researched:       "bg-blue-900/30 text-blue-400",
  contacted:        "bg-indigo-900/30 text-indigo-400",
  replied:          "bg-emerald-900/30 text-emerald-400",
  demo_scheduled:   "bg-green-900/30 text-green-400",
  trial:            "bg-purple-900/30 text-purple-400",
  customer:         "bg-yellow-900/30 text-yellow-400",
  not_interested:   "bg-gray-800 text-gray-500",
  do_not_contact:   "bg-red-900/30 text-red-400",
}

const CONFIDENCE_COLORS: Record<string, string> = {
  verified:    "text-emerald-400",
  accepts_mail:"text-blue-400",
  catch_all:   "text-yellow-400",
  risky:       "text-orange-400",
  unknown:     "text-gray-500",
  invalid:     "text-red-400",
}

function KpiCard({ label, value, sub, color = "text-white" }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-3.5">
      <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/sales/login")

  const { id } = await params

  const prospect = await prisma.prospect.findUnique({
    where:  { id },
    include: {
      contacts: { orderBy: { discoveryDate: "desc" } },
      notes:    { orderBy: { createdAt: "desc" } },
    },
  })

  if (!prospect) notFound()

  // Get emails sent to this prospect's contacts
  const contactEmails = prospect.contacts.map(c => c.email).filter(Boolean) as string[]

  const [sentToProspect, receivedFromProspect, totalOpens] = await Promise.all([
    contactEmails.length > 0
      ? prisma.crmEmail.count({
          where: {
            direction: "sent",
            toAddress: { in: contactEmails },
            isDeleted: false,
          },
        })
      : Promise.resolve(0),
    contactEmails.length > 0
      ? prisma.crmEmail.count({
          where: {
            direction:   "received",
            fromAddress: { in: contactEmails },
            isDeleted:   false,
          },
        })
      : Promise.resolve(0),
    contactEmails.length > 0
      ? prisma.crmEmail.aggregate({
          where: {
            direction: "sent",
            toAddress: { in: contactEmails },
            isDeleted: false,
          },
          _sum: { openCount: true },
        }).then(r => r._sum.openCount ?? 0)
      : Promise.resolve(0),
  ])

  // Link tracking timeline
  const linkClicks = await prisma.linkClick.findMany({
    where:   { prospectId: prospect.id },
    include: {
      events:   { orderBy: { createdAt: "asc" } },
      crmEmail: { select: { subject: true, sentAt: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const allEvents   = linkClicks.flatMap(lc => lc.events)
  const hasRealClick = linkClicks.some(lc => lc.clickCount > 0 && !lc.isBotSuspected)
  const engScore    = computeEngagementScore(allEvents, totalOpens, hasRealClick)
  const engLabel    = scoreLabel(engScore)
  const engColorCls = scoreColor(engScore)

  // Build chronological timeline
  interface TlEvent { at: Date; label: string; sub?: string; color: string; icon: "click" | "eye" | "tour" | "check" | "trophy" | "zap" }
  const timeline: TlEvent[] = []

  for (const lc of linkClicks) {
    if (lc.firstClickedAt && !lc.isBotSuspected) {
      timeline.push({
        at:    lc.firstClickedAt,
        label: "Link clicked",
        sub:   lc.crmEmail?.subject ?? lc.destinationUrl.slice(0, 60),
        color: "text-emerald-400",
        icon:  "click",
      })
    }
  }

  const EVENT_META: Record<string, { label: string; color: string; icon: TlEvent["icon"] }> = {
    tour_started:         { label: "Started product tour",    color: "text-blue-400",    icon: "zap" },
    tour_step_completed:  { label: "Completed a tour step",   color: "text-blue-300",    icon: "check" },
    tour_completed:       { label: "Completed full tour",     color: "text-emerald-400", icon: "trophy" },
    pricing_viewed:       { label: "Viewed pricing page",     color: "text-amber-400",   icon: "eye" },
    demo_requested:       { label: "Requested a live demo",   color: "text-red-400",     icon: "trophy" },
    trial_started:        { label: "Started a free trial",    color: "text-purple-400",  icon: "trophy" },
    returned_visit:       { label: "Returned to site",        color: "text-cyan-400",    icon: "zap" },
    page_viewed:          { label: "Viewed a page",           color: "text-gray-500",    icon: "eye" },
  }

  for (const ev of allEvents) {
    if (ev.isBotSuspected) continue
    if (ev.eventType === "tour_step_completed") continue  // too noisy, skip individual steps
    const meta = EVENT_META[ev.eventType]
    if (!meta) continue
    const data = ev.eventData as Record<string, unknown>
    timeline.push({
      at:    ev.createdAt,
      label: meta.label,
      sub:   typeof data.path === "string" ? data.path : undefined,
      color: meta.color,
      icon:  meta.icon,
    })
  }

  timeline.sort((a, b) => a.at.getTime() - b.at.getTime())

  const lastContact = prospect.lastOutreachDate ?? prospect.lastReplyDate ?? null
  const daysSince   = lastContact ? differenceInDays(new Date(), lastContact) : null
  const empRange    = prospect.employeeCountMin != null || prospect.employeeCountMax != null
    ? [prospect.employeeCountMin, prospect.employeeCountMax].filter(Boolean).join("–")
    : null

  const statusCls = STATUS_COLORS[prospect.currentCrmStatus] ?? "bg-gray-800 text-gray-400"

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href="/sales/outreach/prospects"
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{prospect.companyName}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
              {prospect.currentCrmStatus.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            {prospect.industry && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> {prospect.industry}
              </span>
            )}
            {(prospect.headquartersCity || prospect.headquartersState) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {[prospect.headquartersCity, prospect.headquartersState].filter(Boolean).join(", ")}
              </span>
            )}
            {prospect.website && (
              <a
                href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400"
              >
                <Globe className="w-3 h-3" />
                {prospect.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {prospect.linkedinUrl && (
              <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>
        </div>
        <Link
          href={`/super-admin/crm/prospects/${prospect.id}`}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Full CRM View
        </Link>
      </div>

      {/* ── KPI Section ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Company KPIs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="AI Fit Score"
            value={prospect.aiFitScore ?? "—"}
            sub="out of 100"
            color={prospect.aiFitScore != null && prospect.aiFitScore >= 80 ? "text-yellow-400" : "text-white"}
          />
          <KpiCard
            label="Employees"
            value={empRange ?? "—"}
            sub={empRange ? "estimated range" : "not available"}
          />
          <KpiCard
            label="Emails Sent"
            value={sentToProspect}
            sub="to this company"
            color={sentToProspect > 0 ? "text-emerald-400" : "text-gray-500"}
          />
          <KpiCard
            label="Replies Received"
            value={receivedFromProspect}
            sub={sentToProspect > 0 ? `${((receivedFromProspect / sentToProspect) * 100).toFixed(0)}% reply rate` : undefined}
            color={receivedFromProspect > 0 ? "text-emerald-400" : "text-gray-500"}
          />
          <KpiCard
            label="Est. Opens"
            value={totalOpens}
            sub={sentToProspect > 0 ? `${((totalOpens / sentToProspect) * 100).toFixed(0)}% est. open rate` : "pixel tracking"}
            color={totalOpens > 0 ? "text-blue-400" : "text-gray-500"}
          />
          <div className="bg-gray-800/60 rounded-xl p-3.5">
            <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Engagement Score</p>
            <p className={`text-xl font-bold text-white`}>{engScore}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${engColorCls}`}>
              {engLabel}
            </span>
          </div>
          {lastContact && (
            <KpiCard
              label="Last Contact"
              value={daysSince != null ? `${daysSince}d ago` : "—"}
              sub={formatDistanceToNow(lastContact, { addSuffix: true })}
              color={daysSince != null && daysSince > 30 ? "text-amber-400" : "text-white"}
            />
          )}
          {prospect.pipelineStage && (
            <KpiCard label="Pipeline Stage" value={prospect.pipelineStage} />
          )}
          {prospect.assignedToName && (
            <KpiCard label="Assigned To" value={prospect.assignedToName} />
          )}
          <KpiCard
            label="Fit Confidence"
            value={prospect.confidenceScore != null ? `${prospect.confidenceScore}%` : "—"}
          />
        </div>
      </div>

      {/* ── Research Summary ── */}
      {prospect.researchSummary && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Research Summary</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{prospect.researchSummary}</p>
        </div>
      )}

      {/* ── Pain Points + Fit Reasons ── */}
      {(prospect.operationalPainPoints || prospect.relayFitReasons) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prospect.operationalPainPoints && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pain Points</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.operationalPainPoints}</p>
            </div>
          )}
          {prospect.relayFitReasons && (
            <div className="bg-gray-900 border border-emerald-900/30 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">Why Relay Fits</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.relayFitReasons}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Suggested Outreach ── */}
      {(prospect.suggestedOutreachAngle || prospect.suggestedDemoEmphasis) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prospect.suggestedOutreachAngle && (
            <div className="bg-gray-900 border border-blue-900/30 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3">Outreach Angle</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.suggestedOutreachAngle}</p>
            </div>
          )}
          {prospect.suggestedDemoEmphasis && (
            <div className="bg-gray-900 border border-purple-900/30 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-3">Demo Emphasis</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.suggestedDemoEmphasis}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Contacts ── */}
      {prospect.contacts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Contacts ({prospect.contacts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {prospect.contacts.map(c => {
              const confCls = CONFIDENCE_COLORS[c.emailConfidence ?? "unknown"] ?? "text-gray-500"
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                  </div>
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className={`text-xs font-medium ${confCls} hover:opacity-80 transition-opacity`}
                    >
                      {c.email}
                    </a>
                  )}
                  {c.emailConfidence && (
                    <span className={`text-[10px] ${confCls} uppercase tracking-wide`}>
                      {c.emailConfidence.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Engagement Timeline ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Engagement Timeline
          </h2>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${engColorCls}`}>
            {engLabel} · {engScore} pts
          </span>
        </div>
        {timeline.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-600">
            No tracked engagement yet. Link tracking fires automatically when emails are sent from the CRM.
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {timeline.map((ev, i) => {
              const Icon = ev.icon === "click" ? MousePointer
                : ev.icon === "eye"   ? Eye
                : ev.icon === "tour"  ? TrendingUp
                : ev.icon === "check" ? CheckCircle2
                : ev.icon === "trophy"? Trophy
                : Zap
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className={`mt-0.5 shrink-0 ${ev.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${ev.color}`}>{ev.label}</p>
                    {ev.sub && <p className="text-[10px] text-gray-600 truncate">{ev.sub}</p>}
                  </div>
                  <p className="text-[10px] text-gray-600 shrink-0">
                    {formatDistanceToNow(ev.at, { addSuffix: true })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      {prospect.notes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Notes ({prospect.notes.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {prospect.notes.map(n => (
              <div key={n.id} className="px-5 py-3.5">
                <p className="text-sm text-gray-300 leading-relaxed">{n.noteText}</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  {n.createdBy} · {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
