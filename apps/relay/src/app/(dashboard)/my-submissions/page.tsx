import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  OPEN:       "bg-blue-100 text-blue-700",
  IN_PROGRESS:"bg-yellow-100 text-yellow-700",
  RESOLVED:   "bg-green-100 text-green-700",
  CLOSED:     "bg-gray-100 text-gray-500",
  PENDING:    "bg-yellow-100 text-yellow-700",
  REVIEWED:   "bg-green-100 text-green-700",
  DISMISSED:  "bg-gray-100 text-gray-500",
  CONVERTED:  "bg-blue-100 text-blue-700",
}

const PRIORITY_STYLE: Record<string, string> = {
  CRITICAL: "text-red-600 font-semibold",
  HIGH:     "text-orange-600",
  MEDIUM:   "text-yellow-600",
  LOW:      "text-gray-500",
}

export default async function MySubmissionsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [issues, suggestions] = await Promise.all([
    prisma.issue.findMany({
      where: { reportedById: session.userId, organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { name: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, author: { select: { name: true } } },
        },
      },
    }),
    prisma.suggestion.findMany({
      where: { submittedById: session.userId, organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        routedToUser: { select: { name: true } },
        convertedToIssue: { select: { id: true, title: true } },
      },
    }),
  ])

  return (
    <div>
      <Header title="My Submissions" />
      <div className="p-6 space-y-8 max-w-4xl">

        {/* Issues */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Reported Issues</h2>
            <Link href="/issues/new" className="text-sm text-blue-600 hover:underline">+ Report new issue</Link>
          </div>

          {issues.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm">No issues reported yet.</p>
              <Link href="/issues/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Report your first issue →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map(issue => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[issue.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {issue.status.replace("_", " ")}
                        </span>
                        <span className={`text-xs ${PRIORITY_STYLE[issue.priority] ?? "text-gray-500"}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 text-sm truncate">{issue.title}</p>
                      {issue.assignedTo && (
                        <p className="text-xs text-gray-500 mt-0.5">Assigned to {issue.assignedTo.name}</p>
                      )}
                      {issue.comments[0] && (
                        <div className="mt-2 pl-3 border-l-2 border-gray-100">
                          <p className="text-xs text-gray-500 truncate">
                            <span className="font-medium">{issue.comments[0].author.name}:</span>{" "}
                            {issue.comments[0].content}
                          </p>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Suggestions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Submitted Suggestions</h2>
            <Link href="/suggestions" className="text-sm text-purple-600 hover:underline">+ Submit suggestion</Link>
          </div>

          {suggestions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm">No suggestions submitted yet.</p>
              <Link href="/suggestions" className="mt-3 inline-block text-sm text-purple-600 hover:underline">Submit your first suggestion →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(suggestion => (
                <div
                  key={suggestion.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[suggestion.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {suggestion.status}
                        </span>
                        {suggestion.detectedCategory && (
                          <span className="text-xs text-gray-400">{suggestion.detectedCategory}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 line-clamp-2">{suggestion.content}</p>
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                        {suggestion.routedToUser && (
                          <p className="text-xs text-gray-500">Routed to {suggestion.routedToUser.name}</p>
                        )}
                        {suggestion.adminNote && (
                          <p className="text-xs text-gray-500 italic">Note: {suggestion.adminNote}</p>
                        )}
                        {suggestion.convertedToIssue && (
                          <Link
                            href={`/issues/${suggestion.convertedToIssue.id}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            → Converted: {suggestion.convertedToIssue.title}
                          </Link>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDistanceToNow(new Date(suggestion.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
