import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { subDays, startOfDay, format } from "date-fns"
import { BarChart2, Users, Clock, MousePointerClick, TrendingUp, Target, Mail, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

const TOTAL_TOUR_STEPS = 21

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-400">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function formatActiveTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

export default async function DemoAnalyticsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const since30 = startOfDay(subDays(new Date(), 30))
  const since14 = startOfDay(subDays(new Date(), 13))

  // Email-referred tour sessions via LinkClick → LinkTrackingEvent
  const emailClicks = await prisma.linkClick.findMany({
    where: {
      crmEmailId: { not: null },
      isBotSuspected: false,
      events: { some: { eventType: "tour_started", isBotSuspected: false } },
    },
    include: {
      events: {
        where: { isBotSuspected: false },
        orderBy: { createdAt: "asc" },
      },
      crmEmail: {
        select: {
          sentAt: true,
          demoCall: { select: { contactName: true, companyName: true } },
        },
      },
      prospect: { select: { id: true, companyName: true } },
    },
    orderBy: { firstClickedAt: "desc" },
    take: 100,
  })

  const [all, recent, industriesRaw, ctaStats, conversions, dailyCounts, tourSessions] = await Promise.all([
    prisma.demoAnalytics.count(),
    prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 } } }),
    // Industry breakdown — include nulls so all sessions are accounted for
    prisma.demoAnalytics.groupBy({
      by:    ["industrySelected"],
      _count: true,
    }),
    Promise.all([
      prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 }, clickedStartTrial: true } }),
      prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 }, clickedBookDemo:   true } }),
      prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 }, clickedExplore:    true } }),
    ]),
    prisma.demoAnalytics.count({ where: { convertedToSignup: true, createdAt: { gte: since30 } } }),
    prisma.$queryRaw<{ day: string; cnt: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date::text AS day, COUNT(*)::bigint AS cnt
      FROM "DemoAnalytics"
      WHERE "createdAt" >= ${since14}
      GROUP BY 1
      ORDER BY 1
    `,
    // Tour sessions for step analytics
    prisma.demoAnalytics.findMany({
      where:  { page: "tour", createdAt: { gte: since30 } },
      select: { tourStepsCompleted: true, sessionStart: true, sessionEnd: true },
    }),
  ])

  const [ctaStartTrial, ctaBookDemo, ctaExplore] = ctaStats

  const conversionRate = recent > 0 ? ((conversions / recent) * 100).toFixed(1) : "0"

  // ── Industry breakdown (include null = not selected) ──────────────────────
  const industries = industriesRaw
    .map(r => ({
      industry: r.industrySelected === null || r.industrySelected === ""
        ? "Other / Not Selected"
        : r.industrySelected,
      count: r._count,
      isOther: r.industrySelected === null || r.industrySelected === "",
    }))
    // merge "Other" (user-selected) and null into single "Other / Not Selected" bucket
    .reduce<{ industry: string; count: number; isOther: boolean }[]>((acc, row) => {
      if (row.isOther) {
        const existing = acc.find(r => r.isOther)
        if (existing) existing.count += row.count
        else acc.push(row)
      } else {
        acc.push(row)
      }
      return acc
    }, [])
    .sort((a, b) => b.count - a.count)

  // ── Daily chart (14 days) ─────────────────────────────────────────────────
  const dayMap = new Map(dailyCounts.map(d => [d.day, Number(d.cnt)]))
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const d   = subDays(new Date(), 13 - i)
    const key = format(d, "yyyy-MM-dd")
    return { key, label: format(d, "MMM d"), count: dayMap.get(key) ?? 0 }
  })
  const maxCount = Math.max(...days14.map(d => d.count), 1)

  // ── Tour step analytics ───────────────────────────────────────────────────
  const totalTourSessions = tourSessions.length

  // Completion rate: sessions that reached the final tour step
  const completedCount = tourSessions.filter(s =>
    s.tourStepsCompleted.some(n => n >= TOTAL_TOUR_STEPS - 1)
  ).length
  const completionRate = totalTourSessions > 0
    ? ((completedCount / totalTourSessions) * 100).toFixed(1)
    : "0"

  // Average active time
  const sessionsWithTime = tourSessions.filter(s => s.sessionEnd != null)
  const avgActiveTimeSec = sessionsWithTime.length > 0
    ? sessionsWithTime.reduce((sum, s) => {
        return sum + (s.sessionEnd!.getTime() - s.sessionStart.getTime()) / 1000
      }, 0) / sessionsWithTime.length
    : 0

  // Step-by-step visitor counts
  const stepCounts = Array.from({ length: TOTAL_TOUR_STEPS }, (_, i) => {
    const step = i + 1
    return { step, count: tourSessions.filter(s => s.tourStepsCompleted.includes(step)).length }
  })
  const maxStepCount = Math.max(...stepCounts.map(s => s.count), 1)

  // Most common drop-off step (largest delta between step N and N+1)
  let maxDropoffStep = 1
  let maxDropoff = 0
  for (let i = 0; i < stepCounts.length - 1; i++) {
    const drop = stepCounts[i].count - stepCounts[i + 1].count
    if (drop > maxDropoff) { maxDropoff = drop; maxDropoffStep = stepCounts[i].step }
  }

  // ── Email-referred session processing ────────────────────────────────────
  function stepsForIndustry(ind: string | null) {
    if (ind === "Car Wash") return 20
    if (ind === "Property Management") return 20
    if (ind === "Manufacturing") return 21
    return 22
  }
  function fmtActiveSec(sec: number) {
    if (sec < 60) return `${sec}s`
    const m = Math.floor(sec / 60), s = sec % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }

  type EmailSession = {
    id: string
    contactName: string | null
    companyName: string | null
    emailSentAt: Date | null
    visitDate: Date | null
    industry: string | null
    stepsCompleted: number
    totalSteps: number
    tourCompleted: boolean
    activeTimeSec: number
    ctaLabel: string | null
  }

  const emailSessions: EmailSession[] = emailClicks.map(click => {
    const events = click.events
    const tourStarted = events.find(e => e.eventType === "tour_started")
    const stepEvts = events.filter(e => e.eventType === "tour_step_completed")
    const uniqueSteps = new Set(stepEvts.map(e => (e.eventData as Record<string, unknown>)?.step))
    const industry = (tourStarted?.eventData as Record<string, unknown> | null)?.industry as string | null ?? null
    const visitDate = events.find(e => e.eventType === "tour_started")?.createdAt ?? null

    let ctaLabel: string | null = null
    for (const ev of events) {
      if (ev.eventType === "trial_started") { ctaLabel = "Start Trial"; break }
      if (ev.eventType === "demo_requested") { ctaLabel = "Book Demo"; break }
      if (ev.eventType === "pricing_viewed" && !ctaLabel) ctaLabel = "Explore"
    }

    const activeTimeSec = events.reduce((mx, ev) => Math.max(mx, ev.activeTimeSeconds ?? 0), 0)

    return {
      id: click.id,
      contactName: click.crmEmail?.demoCall?.contactName ?? null,
      companyName: click.crmEmail?.demoCall?.companyName ?? click.prospect?.companyName ?? null,
      emailSentAt: click.crmEmail?.sentAt ?? null,
      visitDate,
      industry,
      stepsCompleted: uniqueSteps.size,
      totalSteps: stepsForIndustry(industry),
      tourCompleted: events.some(e => e.eventType === "tour_completed"),
      activeTimeSec,
      ctaLabel,
    }
  })

  const emailTotal = emailSessions.length
  const emailCompleted = emailSessions.filter(s => s.tourCompleted).length
  const emailCompRate = emailTotal > 0 ? ((emailCompleted / emailTotal) * 100).toFixed(0) : "0"
  const emailAvgSteps = emailTotal > 0
    ? (emailSessions.reduce((sum, s) => sum + s.stepsCompleted, 0) / emailTotal).toFixed(1)
    : "0"

  // Direct (anonymous DemoAnalytics) comparison
  const directAvgSteps = totalTourSessions > 0
    ? (tourSessions.reduce((sum, s) => sum + s.tourStepsCompleted.length, 0) / totalTourSessions).toFixed(1)
    : "0"

  // Industry breakdown for email sessions
  const emailIndustryMap: Record<string, number> = {}
  for (const s of emailSessions) {
    const key = s.industry ?? "Unknown"
    emailIndustryMap[key] = (emailIndustryMap[key] ?? 0) + 1
  }
  const emailIndustries = Object.entries(emailIndustryMap).sort(([, a], [, b]) => b - a)

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Demo Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Visitor behaviour on /demo and /tour pages · last 30 days</p>
      </div>

      {/* ── Top stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sessions"      value={all}                   icon={Users}            color="bg-blue-900/40 text-blue-400" />
        <StatCard label="Last 30 Days"        value={recent}                icon={TrendingUp}        color="bg-emerald-900/40 text-emerald-400" />
        <StatCard label="Conversion Rate"     value={`${conversionRate}%`}  icon={MousePointerClick} color="bg-purple-900/40 text-purple-400" sub="to signup" />
        <StatCard label="Start Trial CTAs"    value={ctaStartTrial}         icon={BarChart2}         color="bg-orange-900/40 text-orange-400" sub="last 30d" />
      </div>

      {/* ── Tour completion row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tour Completion Rate"
          value={totalTourSessions > 0 ? `${completionRate}%` : "—"}
          sub={`${completedCount} of ${totalTourSessions} tour sessions`}
          icon={Target}
          color="bg-teal-900/40 text-teal-400"
        />
        <StatCard
          label="Avg Active Time"
          value={avgActiveTimeSec > 0 ? formatActiveTime(avgActiveTimeSec) : "—"}
          sub="per tour session (last 30d)"
          icon={Clock}
          color="bg-indigo-900/40 text-indigo-400"
        />
        <StatCard
          label="Most Common Drop-off"
          value={maxDropoff > 0 ? `Step ${maxDropoffStep}` : "—"}
          sub={maxDropoff > 0 ? `${maxDropoff} visitors left here` : "not enough data"}
          icon={TrendingUp}
          color="bg-red-900/40 text-red-400"
        />
        <StatCard
          label="Tour Sessions (30d)"
          value={totalTourSessions}
          sub={`${all - totalTourSessions} demo-only sessions`}
          icon={Users}
          color="bg-cyan-900/40 text-cyan-400"
        />
      </div>

      {/* ── Daily sessions chart ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Sessions — Last 14 Days</h2>
        <div className="flex items-end gap-1 h-32">
          {days14.map(day => (
            <div key={day.key} className="flex-1 flex flex-col items-center gap-0" style={{ minWidth: 0 }}>
              <div
                className="w-full bg-emerald-600/70 rounded-t-sm hover:bg-emerald-500 transition-colors"
                title={`${day.label}: ${day.count} sessions`}
                style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? "4px" : "0" }}
              />
            </div>
          ))}
        </div>
        {/* X-axis labels — show every other day to avoid crowding */}
        <div className="flex gap-1 mt-1">
          {days14.map((day, i) => (
            <div key={day.key} className="flex-1 text-center" style={{ minWidth: 0 }}>
              {i % 2 === 0 ? (
                <span className="text-[9px] text-gray-600 block truncate">{day.label}</span>
              ) : (
                <span className="text-[9px] text-gray-800 block">·</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step drop-off chart ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-300">Tour Step Drop-off</h2>
          {maxDropoff > 0 && (
            <span className="text-[11px] text-red-400 font-medium">
              Biggest drop-off at Step {maxDropoffStep} (−{maxDropoff} visitors)
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-600 mb-4">
          Number of tour sessions that reached each step — lower bars reveal where visitors leave
        </p>
        {totalTourSessions === 0 ? (
          <p className="text-gray-600 text-sm">No tour sessions recorded in the last 30 days.</p>
        ) : (
          <>
            <div className="flex items-end gap-0.5 h-28">
              {stepCounts.map(sc => {
                const isDropoffStep = sc.step === maxDropoffStep && maxDropoff > 0
                return (
                  <div
                    key={sc.step}
                    className="flex-1 flex flex-col items-center"
                    style={{ minWidth: 0 }}
                    title={`Step ${sc.step}: ${sc.count} sessions`}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-colors ${isDropoffStep ? "bg-red-500/70 hover:bg-red-500" : "bg-blue-600/60 hover:bg-blue-500"}`}
                      style={{
                        height:    `${(sc.count / maxStepCount) * 100}%`,
                        minHeight: sc.count > 0 ? "3px" : "0",
                      }}
                    />
                  </div>
                )
              })}
            </div>
            {/* Step number labels */}
            <div className="flex gap-0.5 mt-1">
              {stepCounts.map(sc => (
                <div key={sc.step} className="flex-1 text-center" style={{ minWidth: 0 }}>
                  {sc.step % 3 === 1 ? (
                    <span className="text-[9px] text-gray-600 block">{sc.step}</span>
                  ) : (
                    <span className="text-[9px] text-gray-800 block">·</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-700 mt-1">Step number (1–{TOTAL_TOUR_STEPS})</p>
          </>
        )}
      </div>

      {/* ── Bottom row — Industry + CTA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Industry Breakdown</h2>
            <span className="text-[11px] text-gray-600">{all} total sessions</span>
          </div>
          {industries.length === 0 ? (
            <p className="text-gray-600 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {industries.map(row => {
                const pct = all > 0 ? Math.round((row.count / all) * 100) : 0
                return (
                  <div key={row.industry}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`${row.isOther ? "text-gray-500 italic" : "text-gray-300"}`}>
                        {row.industry}
                      </span>
                      <span className="text-gray-500">{row.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.isOther ? "bg-gray-600/60" : "bg-emerald-600/70"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CTA breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">CTA Clicks — Last 30 Days</h2>
          <div className="space-y-3">
            {[
              { label: "Start Trial", value: ctaStartTrial, color: "bg-emerald-600" },
              { label: "Book Demo",   value: ctaBookDemo,   color: "bg-blue-600" },
              { label: "Explore",     value: ctaExplore,    color: "bg-purple-600" },
            ].map(cta => {
              const total = ctaStartTrial + ctaBookDemo + ctaExplore
              const pct   = total > 0 ? Math.round((cta.value / total) * 100) : 0
              return (
                <div key={cta.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{cta.label}</span>
                    <span className="text-gray-500">{cta.value} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${cta.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
            {conversions} visitor{conversions !== 1 ? "s" : ""} converted to signup in last 30 days
          </div>
        </div>
      </div>

      {/* ── Traffic Source Breakdown ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-300">Traffic Source</h2>
          <span className="text-[11px] text-gray-600 ml-auto">Email-referred vs Direct</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email-referred */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-xs font-semibold text-gray-300">Email ({emailTotal} sessions)</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                <span>Tour completion rate</span>
                <span className={`font-semibold ${parseInt(emailCompRate) >= 50 ? "text-emerald-400" : "text-gray-300"}`}>{emailCompRate}%</span>
              </div>
              <div className="flex items-center justify-between text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                <span>Avg steps completed</span>
                <span className="font-semibold text-gray-300">{emailAvgSteps}</span>
              </div>
              {emailIndustries.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                  <div className="text-gray-500 mb-1.5">Industries selected</div>
                  <div className="space-y-1">
                    {emailIndustries.slice(0, 5).map(([ind, cnt]) => (
                      <div key={ind} className="flex items-center justify-between">
                        <span className="text-gray-400">{ind}</span>
                        <span className="text-gray-500">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {emailTotal === 0 && (
                <p className="text-gray-600 text-xs italic">No email-referred tour sessions yet. Send tracked emails and watch this fill in.</p>
              )}
            </div>
          </div>

          {/* Direct */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
              <span className="text-xs font-semibold text-gray-300">Direct ({totalTourSessions} sessions)</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                <span>Tour completion rate</span>
                <span className={`font-semibold ${parseFloat(completionRate) >= 50 ? "text-emerald-400" : "text-gray-300"}`}>{completionRate}%</span>
              </div>
              <div className="flex items-center justify-between text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                <span>Avg steps completed</span>
                <span className="font-semibold text-gray-300">{directAvgSteps}</span>
              </div>
              {totalTourSessions === 0 && (
                <p className="text-gray-600 text-xs italic">No direct tour sessions recorded in last 30 days.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visitors From Your Emails ── */}
      {emailSessions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-300">Visitors From Your Emails</h2>
            <span className="text-[11px] text-gray-600 ml-auto">{emailSessions.length} known session{emailSessions.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-600 border-b border-gray-800">
                  <th className="text-left pb-2 font-medium pr-4">Contact / Company</th>
                  <th className="text-left pb-2 font-medium pr-4">Email Sent</th>
                  <th className="text-left pb-2 font-medium pr-4">Tour Visit</th>
                  <th className="text-left pb-2 font-medium pr-4">Industry</th>
                  <th className="text-left pb-2 font-medium pr-4">Steps</th>
                  <th className="text-left pb-2 font-medium pr-4">Time</th>
                  <th className="text-left pb-2 font-medium">CTA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {emailSessions.slice(0, 50).map(s => (
                  <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-gray-300">{s.contactName ?? "—"}</div>
                      <div className="text-gray-600">{s.companyName ?? "Unknown company"}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {s.emailSentAt ? s.emailSentAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {s.visitDate ? s.visitDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{s.industry ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-gray-300 font-medium">{s.stepsCompleted}</span>
                      <span className="text-gray-600"> / {s.totalSteps}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {s.activeTimeSec > 0 ? fmtActiveSec(s.activeTimeSec) : "—"}
                    </td>
                    <td className="py-2.5">
                      {s.ctaLabel ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px] font-medium">{s.ctaLabel}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
