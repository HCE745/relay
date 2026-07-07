import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import { Header } from "@/components/layout/header"
import { SuggestionForm } from "@/components/suggestions/suggestion-form"
import { SuggestionInbox } from "@/components/suggestions/suggestion-inbox"

export const dynamic = "force-dynamic"

export default async function SuggestionsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isAdmin = session.role === "ADMIN" || session.role === "HR"
  const orgId = session.organizationId

  // Suggestions visible to the current user
  const suggestions = await prisma.suggestion.findMany({
    where: isAdmin
      ? { organizationId: orgId }
      : { organizationId: orgId, routedToUserId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      submittedBy: { select: { id: true, name: true } },
      routedToUser: { select: { id: true, name: true } },
      convertedToIssue: { select: { id: true, title: true } },
    },
  })

  // Users needed for override picker (form) and reassign/convert selects (inbox)
  const [users, org, userSettings] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true } }),
    prisma.userSettings.findUnique({ where: { userId: session.userId }, select: { aiSuggestionsOn: true, aiSuggestionsCollapsed: true } }),
  ])

  const aiPolicy = org?.aiSuggestionsPolicy ?? "user_choice"
  const aiSuggestionsEnabled =
    !!org?.aiSuggestionsAvailable &&
    (aiPolicy === "on_all" || (aiPolicy === "user_choice" && (userSettings?.aiSuggestionsOn ?? true)))

  // Cookie takes precedence for collapsed pref (same logic as issue detail page)
  const cookieStore = await cookies()
  const panelsCookie = cookieStore.get("relay_panels_collapsed")
  const panelsCollapsed = panelsCookie
    ? panelsCookie.value === "1"
    : (userSettings?.aiSuggestionsCollapsed ?? false)

  const pendingCount = suggestions.filter((s: { status: string }) => s.status === "PENDING").length

  return (
    <div>
      <Header title={isAdmin ? "Suggestion Inbox" : "Suggestions"} />
      {/* Mobile page title */}
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">
          {isAdmin ? "Suggestion Inbox" : "Suggestions"}
        </h1>
      </div>
      <div className="px-3 md:px-6 py-2 md:py-6 max-w-3xl space-y-4 md:space-y-6">

        {/* Personal routed inbox — shown for non-admins if they have routed items */}
        {!isAdmin && suggestions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900">Suggestions Routed to You</h2>
              {pendingCount > 0 && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              These suggestions were routed to you for review. You can forward them or convert them into a work order.
            </p>
            <SuggestionInbox
              initialSuggestions={JSON.parse(JSON.stringify(suggestions))}
              users={users}
              sessionUserId={session.userId}
              isAdmin={false}
              defaultApproachesExpanded={!panelsCollapsed}
            />
          </div>
        )}

        {/* Admin full inbox */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900">All Suggestions</h2>
              {pendingCount > 0 && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Suggestions are auto-routed by content. Use the forward button to reassign, or convert to a work order.
            </p>
            <SuggestionInbox
              initialSuggestions={JSON.parse(JSON.stringify(suggestions))}
              users={users}
              sessionUserId={session.userId}
              isAdmin={true}
              defaultApproachesExpanded={!panelsCollapsed}
            />
          </div>
        )}

        {/* Submit form — available to everyone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Submit a Suggestion</h2>
          <p className="text-sm text-gray-500 mb-6">
            Have an idea or feedback? It will be automatically routed to the right person based on what you write.
          </p>
          <SuggestionForm users={users} aiSuggestionsEnabled={aiSuggestionsEnabled} />
        </div>
      </div>
    </div>
  )
}
