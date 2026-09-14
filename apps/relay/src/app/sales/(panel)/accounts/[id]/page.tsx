import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import {
  Building2, Mail, Phone, Globe, User, Calendar, ArrowLeft,
  CheckCircle2, Clock, Briefcase, FileText, MessageSquare,
  TrendingUp, Star, ExternalLink,
} from "lucide-react"
import { computeEngagementScore, scoreLabel, scoreColor } from "@/lib/engagement-score"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

const STATUS_COLORS: Record<string, string> = {
  Scheduled:   "bg-blue-900/40 text-blue-300",
  Completed:   "bg-emerald-900/40 text-emerald-300",
  "No-Show":   "bg-red-900/40 text-red-300",
  Cancelled:   "bg-gray-800 text-gray-400",
  "Follow-Up": "bg-amber-900/40 text-amber-300",
}

const STAGE_COLORS: Record<string, string> = {
  Qualified:   "bg-blue-900/40 text-blue-300",
  Demo:        "bg-indigo-900/40 text-indigo-300",
  Proposal:    "bg-yellow-900/40 text-yellow-300",
  Negotiating: "bg-orange-900/40 text-orange-300",
  "Closed Won":  "bg-emerald-900/40 text-emerald-300",
  "Closed Lost": "bg-gray-800 text-gray-400",
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const { id } = await params

  const call = await prisma.demoCall.findUnique({
    where: { id },
    include: {
      assignedTo:   { select: { id: true, name: true, email: true } },
      organization: true,
      prospect: {
        include: {
          contacts: { orderBy: { createdAt: "asc" } },
          notes:    { orderBy: { createdAt: "desc" }, take: 5 },
        },
      },
      opportunities: {
        orderBy: { updatedAt: "desc" },
        include: { assignedTo: { select: { name: true } } },
      },
      crmEmails: {
        where: { isDeleted: false },
        orderBy: { sentAt: "desc" },
        take: 10,
      },
      tasks: {
        orderBy: { dueAt: "asc" },
        include: { assignedTo: { select: { name: true } } },
      },
    },
  })

  if (!call) notFound()

  const email = call.contactEmail.toLowerCase()

  // Engagement data
  const [clickRows, openAgg] = await Promise.all([
    prisma.linkClick.findMany({
      where: { isBotSuspected: false, crmEmail: { contactEmail: { equals: email, mode: "insensitive" } } },
      take: 15,
      select: {
        destinationUrl: true,
        clickCount:     true,
        lastClickedAt:  true,
        events: {
          where:   { isBotSuspected: false },
          orderBy: { createdAt: "desc" },
          take:    5,
          select:  { eventType: true, isBotSuspected: true, createdAt: true },
        },
      },
    }),
    prisma.crmEmail.aggregate({
      where: { contactEmail: { equals: email, mode: "insensitive" }, openedAt: { not: null } },
      _count: true,
    }),
  ])

  const allEvents  = clickRows.flatMap(c => c.events)
  const hasClick   = clickRows.some(c => c.clickCount > 0)
  const engScore   = computeEngagementScore(allEvents, openAgg._count, hasClick)
  const engLabel   = scoreLabel(engScore)
  const engColor   = scoreColor(engScore)

  const openOpps   = call.opportunities.filter(o => o.stage !== "Closed Won" && o.stage !== "Closed Lost")
  const latestOpp  = call.opportunities[0]
  const org        = call.organization

  return (
    <div className="p-6 min-h-screen">
      {/* Back */}
      <div className="mb-4">
        <Link href="/sales/accounts" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Accounts
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-gray-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{call.companyName}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[call.callStatus] ?? "bg-gray-800 text-gray-400"}`}>
              {call.callStatus}
            </span>
            {call.industry && <span className="text-gray-500 text-xs">{call.industry}</span>}
            {call.assignedTo && <span className="text-gray-500 text-xs">Rep: {call.assignedTo.name}</span>}
            {org && (
              <span className="text-emerald-400 text-xs font-medium">
                {org.plan} · {org.subscriptionStatus}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/super-admin/crm/demo-calls/${call.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full CRM View
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: contact + company info */}
        <div className="space-y-4">
          {/* Primary contact */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Primary Contact</h2>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-white">{call.contactName}</p>
                {call.contactRole && <p className="text-gray-400 text-xs">{call.contactRole}</p>}
                <div className="mt-2 space-y-1">
                  <a href={`mailto:${call.contactEmail}`} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                    <Mail className="w-3.5 h-3.5" /> {call.contactEmail}
                  </a>
                  {call.contactPhone && (
                    <a href={`tel:${call.contactPhone}`} className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Phone className="w-3.5 h-3.5" /> {call.contactPhone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Company details */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Company Details</h2>
            <div className="space-y-2 text-sm">
              {call.employeeCount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Employees</span>
                  <span className="text-gray-200">{call.employeeCount}</span>
                </div>
              )}
              {call.locationCount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Locations</span>
                  <span className="text-gray-200">{call.locationCount}</span>
                </div>
              )}
              {call.leadSource && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Lead Source</span>
                  <span className="text-gray-200">{call.leadSource}</span>
                </div>
              )}
              {call.productInterest && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Product Interest</span>
                  <span className="text-gray-200">{call.productInterest}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Demo Date</span>
                <span className="text-gray-200">{fmtDate(call.scheduledAt)}</span>
              </div>
            </div>
          </section>

          {/* Engagement */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Engagement</h2>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xl font-bold ${engColor}`}>{engScore}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${engColor} bg-gray-800`}>{engLabel}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="font-bold text-white">{openAgg._count}</p>
                <p className="text-gray-500">Opens</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="font-bold text-white">{clickRows.reduce((s, r) => s + r.clickCount, 0)}</p>
                <p className="text-gray-500">Clicks</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="font-bold text-white">{allEvents.length}</p>
                <p className="text-gray-500">Events</p>
              </div>
            </div>
          </section>

          {/* Customer account (if converted) */}
          {org && (
            <section className="bg-emerald-900/20 border border-emerald-900/40 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Customer Account</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan</span>
                  <span className="text-gray-200 capitalize">{org.plan.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-200 capitalize">{org.subscriptionStatus}</span>
                </div>
                {org.trialEndsAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trial ends</span>
                    <span className="text-gray-200">{fmtDate(org.trialEndsAt)}</span>
                  </div>
                )}
                {org.monthlyTotalAfterDiscount != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">MRR</span>
                    <span className="text-emerald-300 font-semibold">${org.monthlyTotalAfterDiscount}/mo</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Middle column: opportunities + tasks */}
        <div className="space-y-4">
          {/* Opportunities */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Opportunities</h2>
              <Link href={`/sales/opportunities`} className="text-xs text-gray-500 hover:text-gray-300">View all</Link>
            </div>
            {call.opportunities.length === 0 ? (
              <p className="text-gray-600 text-sm">No opportunities yet.</p>
            ) : (
              <div className="space-y-2">
                {call.opportunities.map(opp => (
                  <Link
                    key={opp.id}
                    href={`/sales/opportunities/${opp.id}`}
                    className="block p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate">{opp.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-2 shrink-0 ${STAGE_COLORS[opp.stage] ?? "bg-gray-800 text-gray-400"}`}>
                        {opp.stage}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {opp.value && <span>${opp.value.toLocaleString()}</span>}
                      {opp.nextStepDate && (
                        <span className={new Date(opp.nextStepDate) < new Date() ? "text-red-400" : "text-gray-500"}>
                          Next: {fmtDate(opp.nextStepDate)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Tasks */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tasks</h2>
            {call.tasks.length === 0 ? (
              <p className="text-gray-600 text-sm">No tasks.</p>
            ) : (
              <div className="space-y-2">
                {call.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/40">
                    {task.completedAt ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.completedAt ? "line-through text-gray-500" : "text-gray-200"}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {task.assignedTo.name} · {task.dueAt ? fmtDate(task.dueAt) : "No due date"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AI Research (if prospect linked) */}
          {call.prospect && (call.prospect.researchSummary || call.prospect.operationalPainPoints) && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">AI Research</h2>
              {call.prospect.aiFitScore != null && (
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-gray-300">Fit Score: <strong className="text-amber-400">{call.prospect.aiFitScore}/100</strong></span>
                </div>
              )}
              {call.prospect.researchSummary && (
                <p className="text-xs text-gray-400 leading-relaxed mb-2">{call.prospect.researchSummary}</p>
              )}
              {call.prospect.operationalPainPoints && (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-1">Pain Points</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{call.prospect.operationalPainPoints}</p>
                </>
              )}
            </section>
          )}

          {/* Prospect contacts */}
          {call.prospect && call.prospect.contacts.length > 0 && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Buying Committee</h2>
              <div className="space-y-2">
                {call.prospect.contacts.map(c => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{c.name}</p>
                      {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                      {(c.roles && c.roles.length > 0) ? (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {c.roles.map(r => (
                            <span key={r} className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">
                              {r.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      ) : c.role ? (
                        <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block">
                          {c.role.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column: email thread */}
        <div className="space-y-4">
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Thread</h2>
              <Link
                href={`/super-admin/crm/demo-calls/${call.id}`}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Open full view
              </Link>
            </div>
            {call.crmEmails.length === 0 ? (
              <p className="text-gray-600 text-sm">No emails yet.</p>
            ) : (
              <div className="space-y-3">
                {call.crmEmails.map(em => (
                  <div key={em.id} className="border-l-2 border-gray-800 pl-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${em.direction === "received" ? "text-emerald-400" : "text-blue-400"}`}>
                        {em.direction === "received" ? "← Received" : "→ Sent"}
                      </span>
                      <span className="text-[10px] text-gray-600">{fmtDateTime(em.sentAt)}</span>
                    </div>
                    <p className="text-xs text-gray-300 truncate">{em.subject}</p>
                    {em.openedAt && <p className="text-[10px] text-gray-600 mt-0.5">Opened {fmtDate(em.openedAt)}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Call notes */}
          {(call.callNotes || call.painPoints || call.objectionNotes) && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Call Notes</h2>
              <div className="space-y-3 text-xs text-gray-400">
                {call.callNotes && (
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Notes</p>
                    <p className="leading-relaxed">{call.callNotes}</p>
                  </div>
                )}
                {call.painPoints && (
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Pain Points</p>
                    <p className="leading-relaxed">{call.painPoints}</p>
                  </div>
                )}
                {call.objectionNotes && (
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Objections</p>
                    <p className="leading-relaxed">{call.objectionNotes}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Prospect notes */}
          {call.prospect && call.prospect.notes.length > 0 && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Notes</h2>
              <div className="space-y-2">
                {call.prospect.notes.map(n => (
                  <div key={n.id} className="text-xs">
                    <p className="text-gray-600 mb-0.5">{fmtDate(n.createdAt)} · {n.createdBy ?? "System"}</p>
                    <p className="text-gray-300 leading-relaxed">{n.noteText}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
