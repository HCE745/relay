import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { isProfessional } from "@/lib/pricing"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Plus, ClipboardList, CheckCircle, Clock, BarChart2, Lock, Loader2,
} from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  DRAFT:  "bg-gray-100 text-gray-500",
  ACTIVE: "bg-green-100 text-green-800",
  CLOSED: "bg-blue-100 text-blue-800",
}

export default async function SurveysPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId       = session.organizationId
  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"
  const isManager   = session.role === "MANAGER"
  const canManage   = isAdminOrHR

  const [org, surveys, myResponses] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
    prisma.survey.findMany({
      where: {
        organizationId: orgId,
        ...(!isAdminOrHR && !isManager ? { status: "ACTIVE" } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count:    { select: { questions: true, responses: true } },
      },
    }),
    prisma.surveyResponse.findMany({
      where:  { surveyId: { in: [] }, respondentId: session.userId },
      select: { surveyId: true },
    }),
  ])

  // Fetch responded survey IDs for this user
  const respondedIds = new Set(
    (await prisma.surveyResponse.findMany({
      where:  { surveyId: { in: surveys.map(s => s.id) }, respondentId: session.userId },
      select: { surveyId: true },
    })).map(r => r.surveyId)
  )

  const professional = isProfessional(org?.plan ?? "essentials")
  const canCreate    = canManage && professional

  const activeSurveys = surveys.filter(s => s.status === "ACTIVE")
  const draftSurveys  = surveys.filter(s => s.status === "DRAFT")
  const closedSurveys = surveys.filter(s => s.status === "CLOSED")

  return (
    <div>
      <Header title="Surveys" />
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Surveys</h1>
      </div>

      <div className="px-3 md:px-6 py-4 md:py-8 max-w-3xl space-y-8">

        {/* Admin manage header */}
        {canManage && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Create and manage surveys for your team.</p>
            {canCreate ? (
              <Link
                href="/surveys/manage/new"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                <Plus className="w-4 h-4" />
                New Survey
              </Link>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-400 text-sm rounded-lg cursor-not-allowed">
                <Lock className="w-3.5 h-3.5" />
                Professional required
              </div>
            )}
          </div>
        )}

        {/* Active surveys — everyone sees these */}
        {activeSurveys.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Active Surveys
            </h2>
            <div className="space-y-3">
              {activeSurveys.map(s => {
                const responded = respondedIds.has(s.id)
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{s.title}</span>
                        {responded && (
                          <span className="flex items-center gap-0.5 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" /> Responded
                          </span>
                        )}
                      </div>
                      {s.description && <p className="text-sm text-gray-500 truncate mb-1">{s.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{s._count.questions} question{s._count.questions !== 1 ? "s" : ""}</span>
                        {canManage && <span>{s._count.responses} response{s._count.responses !== 1 ? "s" : ""}</span>}
                        <span>by {s.createdBy.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManage && (
                        <Link href={`/surveys/${s.id}/results`} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                          <BarChart2 className="w-3.5 h-3.5" />
                          Results
                        </Link>
                      )}
                      {!responded && (
                        <Link href={`/surveys/${s.id}`} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          Take Survey
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No active surveys for employees */}
        {!canManage && !isManager && activeSurveys.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No active surveys right now</p>
            <p className="text-xs text-gray-300 mt-1">Check back later</p>
          </div>
        )}

        {/* Admin: Draft surveys */}
        {canManage && draftSurveys.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Drafts
            </h2>
            <div className="space-y-2">
              {draftSurveys.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-gray-900 text-sm">{s.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE.DRAFT}`}>Draft</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {s._count.questions} question{s._count.questions !== 1 ? "s" : ""} ·{" "}
                      created {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Link href={`/surveys/manage/new?edit=${s.id}`} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                    Edit
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin/Manager: Closed surveys */}
        {(canManage || isManager) && closedSurveys.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-gray-400" />
              Past Surveys
            </h2>
            <div className="space-y-2">
              {closedSurveys.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-gray-900 text-sm">{s.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE.CLOSED}`}>Closed</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {s._count.responses} response{s._count.responses !== 1 ? "s" : ""} ·{" "}
                      {s._count.questions} question{s._count.questions !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Link href={`/surveys/${s.id}/results`} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-1">
                    <BarChart2 className="w-3.5 h-3.5" />
                    Results
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
