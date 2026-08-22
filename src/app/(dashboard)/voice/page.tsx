import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { isProfessional } from "@/lib/pricing"
import Link from "next/link"
import { AlertCircle, Lightbulb, MessageSquare, AlertTriangle, ClipboardList, ChevronRight, Inbox } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function VoicePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const orgId = session.organizationId

  const [org, mySubmissions] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    }),
    prisma.suggestion.findMany({
      where: { organizationId: orgId, submittedById: session.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, status: true, content: true, createdAt: true },
    }),
  ])

  const professional = isProfessional(org?.plan ?? "essentials")

  const pendingIssueCount = await prisma.issue.count({
    where: { organizationId: orgId, reportedById: session.userId, status: { notIn: ["CLOSED", "RESOLVED"] } },
  }).catch(() => 0)

  const tiles = [
    {
      href: "/issues/new",
      icon: AlertCircle,
      label: "Report an Issue",
      description: "Something is broken or needs immediate attention",
      color: "text-red-600",
      bg: "bg-red-50 hover:bg-red-100 border-red-100",
      always: true,
    },
    {
      href: "/suggestions",
      icon: Lightbulb,
      label: "Make a Suggestion",
      description: "Share an idea or process improvement",
      color: "text-blue-600",
      bg: "bg-blue-50 hover:bg-blue-100 border-blue-100",
      always: true,
    },
    {
      href: "/suggestions?type=FEEDBACK",
      icon: MessageSquare,
      label: "Give Feedback",
      description: "Share your thoughts on a process, decision, or experience",
      color: "text-purple-600",
      bg: "bg-purple-50 hover:bg-purple-100 border-purple-100",
      always: false,
      requiresPro: true,
    },
    {
      href: "/suggestions?type=CONCERN",
      icon: AlertTriangle,
      label: "Share a Concern",
      description: "Something that needs attention or has been bothering you",
      color: "text-amber-600",
      bg: "bg-amber-50 hover:bg-amber-100 border-amber-100",
      always: false,
      requiresPro: true,
    },
    {
      href: "/surveys",
      icon: ClipboardList,
      label: "Take a Survey",
      description: "Respond to team surveys and pulse checks",
      color: "text-green-600",
      bg: "bg-green-50 hover:bg-green-100 border-green-100",
      always: false,
      requiresPro: true,
      comingSoon: true,
    },
  ]

  const visibleTiles = tiles.filter(t => t.always || professional)

  const STATUS_LABEL: Record<string, string> = {
    PENDING: "Pending",
    REVIEWED: "Reviewed",
    DISMISSED: "Dismissed",
    CONVERTED: "Converted",
    IMPLEMENTED: "Implemented",
  }

  const STATUS_COLOR: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    REVIEWED: "bg-green-100 text-green-800",
    DISMISSED: "bg-gray-100 text-gray-500",
    CONVERTED: "bg-blue-100 text-blue-800",
    IMPLEMENTED: "bg-emerald-100 text-emerald-800",
  }

  const TYPE_LABEL: Record<string, string> = {
    SUGGESTION: "Suggestion",
    FEEDBACK: "Feedback",
    CONCERN: "Concern",
  }

  return (
    <div>
      <Header title="Employee Voice" />
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Employee Voice</h1>
      </div>

      <div className="px-3 md:px-6 py-4 md:py-8 max-w-3xl space-y-8">
        {/* Intro */}
        <div>
          <p className="text-gray-500 text-sm">
            Your voice matters. Use these tools to report issues, share ideas, and give honest feedback.
          </p>
        </div>

        {/* Action tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleTiles.map(tile => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.href}
                href={tile.comingSoon ? "#" : tile.href}
                className={`relative flex items-start gap-3 p-4 rounded-xl border transition-colors ${tile.bg} ${tile.comingSoon ? "pointer-events-none opacity-60" : ""}`}
              >
                <div className={`mt-0.5 shrink-0 ${tile.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{tile.label}</span>
                    {tile.comingSoon && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-medium">Soon</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tile.description}</p>
                </div>
                {!tile.comingSoon && <ChevronRight className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />}
              </Link>
            )
          })}
        </div>

        {/* Pending issues shortcut */}
        {pendingIssueCount > 0 && (
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-800">
                You have <span className="font-semibold">{pendingIssueCount}</span> open issue{pendingIssueCount !== 1 ? "s" : ""}
              </span>
            </div>
            <Link href="/issues" className="text-xs text-red-600 font-medium hover:underline">View</Link>
          </div>
        )}

        {/* Your recent submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Your Submissions</h2>
            <Link href="/my-submissions" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>

          {mySubmissions.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Inbox className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nothing submitted yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mySubmissions.map(s => (
                <div key={s.id} className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-gray-500">{TYPE_LABEL[s.type] ?? "Submission"}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{s.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
