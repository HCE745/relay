import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Plus, ClipboardList, ExternalLink, BarChart2 } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  DRAFT:  "Draft",
  ACTIVE: "Active",
  CLOSED: "Closed",
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT:  "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-100 text-green-700",
  CLOSED: "bg-red-100 text-red-700",
}

export default async function CustomerSurveysPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const canManage = ["ADMIN", "HR"].includes(session.role)

  const surveys = await prisma.customerSurvey.findMany({
    where:   { organizationId: session.organizationId },
    include: { location: { select: { name: true } }, createdBy: { select: { name: true } }, _count: { select: { responses: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Surveys</h1>
          <p className="text-sm text-gray-500 mt-1">Collect structured feedback from customers via shareable links</p>
        </div>
        {canManage && (
          <Link
            href="/customer-voice/surveys/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Survey
          </Link>
        )}
      </div>

      {surveys.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-600">No surveys yet</p>
          {canManage && (
            <Link href="/customer-voice/surveys/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              Create your first survey →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                  {s.location && <span className="text-xs text-gray-400">{s.location.name}</span>}
                </div>
                <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s._count.responses} response{s._count.responses !== 1 ? "s" : ""} · Created by {s.createdBy.name}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === "ACTIVE" && (
                  <a
                    href={`/survey/${s.surveyToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Open survey link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <Link
                  href={`/customer-voice/surveys/${s.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Results
                </Link>
                {canManage && (
                  <Link
                    href={`/customer-voice/surveys/${s.id}/edit`}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
