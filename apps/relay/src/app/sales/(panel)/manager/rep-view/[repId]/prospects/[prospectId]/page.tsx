import { redirect, notFound } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft, Building2, MapPin, Users, User, Mail, Phone, ExternalLink, CheckSquare, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—"
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export default async function RepViewProspectDetailPage({
  params,
}: {
  params: Promise<{ repId: string; prospectId: string }>
}) {
  const { repId, prospectId } = await params

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      contacts: {
        orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
        select: {
          id: true, name: true, title: true, email: true, phone: true,
          linkedinUrl: true, isPrimaryContact: true, isDecisionMaker: true,
        },
      },
      tasks: {
        where: { assignedToId: repId },
        orderBy: { dueAt: "asc" },
        select: {
          id: true, title: true, taskType: true, dueAt: true,
          completedAt: true, priority: true, notes: true,
        },
        take: 20,
      },
      opportunities: {
        where: { assignedToId: repId },
        select: {
          id: true, title: true, stage: true, value: true, closeDate: true,
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  })

  if (!prospect) notFound()
  // Enforce rep scoping — this prospect must belong to the rep being viewed
  if (prospect.assignedToId !== repId) redirect(`/sales/manager/rep-view/${repId}/prospects`)

  const basePath = `/sales/manager/rep-view/${repId}`
  const empRange = prospect.employeeCountMin && prospect.employeeCountMax
    ? `${prospect.employeeCountMin}–${prospect.employeeCountMax}`
    : prospect.employeeCountMin ? `${prospect.employeeCountMin}+` : null

  const openTasks = prospect.tasks.filter(t => !t.completedAt)
  const doneTasks = prospect.tasks.filter(t => t.completedAt)

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`${basePath}/prospects`}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Prospects
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white">{prospect.companyName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
              {prospect.industry && <span>{prospect.industry}</span>}
              {(prospect.headquartersCity || prospect.headquartersState) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[prospect.headquartersCity, prospect.headquartersState].filter(Boolean).join(", ")}
                </span>
              )}
              {empRange && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {empRange} employees
                </span>
              )}
              {prospect.website && (
                <a
                  href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>
          </div>
          {prospect.aiFitScore != null && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 mb-0.5">AI Fit Score</p>
              <p className="text-2xl font-semibold text-emerald-400">{prospect.aiFitScore}</p>
            </div>
          )}
        </div>

        {prospect.description && (
          <p className="mt-4 text-sm text-gray-400 leading-relaxed">{prospect.description}</p>
        )}

        {prospect.researchSummary && (
          <div className="mt-4 rounded-md bg-gray-800/60 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Research Summary</p>
            <p className="text-sm text-gray-300 leading-relaxed">{prospect.researchSummary}</p>
          </div>
        )}
      </div>

      {/* Contacts */}
      {prospect.contacts.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Contacts ({prospect.contacts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-800">
            {prospect.contacts.map(c => (
              <div key={c.id} className="px-5 py-3.5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    {c.isPrimaryContact && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">Primary</span>
                    )}
                    {c.isDecisionMaker && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400">DM</span>
                    )}
                  </div>
                  {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  {c.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {c.phone}
                    </span>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {prospect.opportunities.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Opportunities ({prospect.opportunities.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {prospect.opportunities.map(o => (
              <Link
                key={o.id}
                href={`${basePath}/opportunities/${o.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{o.stage}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="text-white font-medium">{fmtMoney(o.value ? Number(o.value) : null)}</span>
                  {o.closeDate && <span>Close {fmtDate(o.closeDate)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      {prospect.tasks.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-gray-500" />
              Tasks ({prospect.tasks.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-800">
            {[...openTasks, ...doneTasks].map(t => {
              const overdue = !t.completedAt && t.dueAt && new Date(t.dueAt) < new Date()
              return (
                <div key={t.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center ${
                    t.completedAt ? "bg-emerald-900/30 border border-emerald-700" : "border border-gray-600"
                  }`}>
                    {t.completedAt && <span className="text-emerald-400 text-[8px]">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.completedAt ? "text-gray-500 line-through" : "text-white"}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs">
                      {t.dueAt && (
                        <span className={`flex items-center gap-1 ${overdue ? "text-red-400" : "text-gray-500"}`}>
                          <Clock className="w-3 h-3" />
                          {overdue ? "Overdue · " : "Due "}{fmtDate(t.dueAt)}
                        </span>
                      )}
                      <span className={`capitalize ${
                        t.priority === "high" ? "text-red-400" : t.priority === "low" ? "text-gray-600" : "text-gray-500"
                      }`}>{t.priority}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Research details */}
      {(prospect.operationalPainPoints || prospect.relayFitReasons || prospect.suggestedOutreachAngle) && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Research Details</h2>
          {prospect.operationalPainPoints && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Pain Points</p>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.operationalPainPoints}</p>
            </div>
          )}
          {prospect.relayFitReasons && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Relay Fit</p>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.relayFitReasons}</p>
            </div>
          )}
          {prospect.suggestedOutreachAngle && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">Outreach Angle</p>
              <p className="text-sm text-gray-300 leading-relaxed">{prospect.suggestedOutreachAngle}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
