import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import { Header } from "@/components/layout/header"
import { SuggestionForm } from "@/components/suggestions/suggestion-form"
import { SuggestionInbox } from "@/components/suggestions/suggestion-inbox"
import { isProfessional, isRecognitionEnabled } from "@/lib/pricing"
import type { SuggestionType } from "@/lib/suggestion-constants"

export const dynamic = "force-dynamic"

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
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

  const { type: rawTypeParam } = await searchParams
  const VALID_TYPES: SuggestionType[] = ["SUGGESTION", "FEEDBACK", "CONCERN"]
  const defaultType: SuggestionType = VALID_TYPES.includes(rawTypeParam as SuggestionType)
    ? (rawTypeParam as SuggestionType)
    : "SUGGESTION"

  // Users needed for override picker (form) and reassign/convert selects (inbox)
  const [users, org, userSettings] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true, plan: true, recognition_enabled: true } }),
    prisma.userSettings.findUnique({ where: { userId: session.userId }, select: { aiSuggestionsOn: true, aiSuggestionsCollapsed: true } }),
  ])

  const recognitionEnabled = isRecognitionEnabled(org?.plan ?? "essentials", org?.recognition_enabled ?? false)

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

        {/* Non-admin empty state — shown when no suggestions are routed to them */}
        {!isAdmin && suggestions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3 3 0 01-.77 1.74L12 19.5l-2.121-1.414a3 3 0 01-.77-1.74l-.347-.347z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 mb-1">No suggestions yet</p>
            <p className="text-sm text-gray-500 mb-5">Use the form below to submit your first idea or improvement.</p>
          </div>
        )}

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
              recognitionEnabled={recognitionEnabled}
            />
          </div>
        )}

        {/* Admin full inbox */}
        {isAdmin && suggestions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3 3 0 01-.77 1.74L12 19.5l-2.121-1.414a3 3 0 01-.77-1.74l-.347-.347z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 mb-1">No suggestions yet</p>
            <p className="text-sm text-gray-500 mb-6">Invite your team to start submitting ideas. You can also create a survey to collect structured feedback.</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <a href="/settings/team" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                Invite Team Members
              </a>
              <a href="/surveys" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                Create a Survey
              </a>
            </div>
          </div>
        )}
        {isAdmin && suggestions.length > 0 && (
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
              recognitionEnabled={recognitionEnabled}
            />
          </div>
        )}

        {/* Submit form — available to everyone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Submit a Suggestion</h2>
          <p className="text-sm text-gray-500 mb-6">
            Have an idea or feedback? It will be automatically routed to the right person based on what you write.
          </p>
          <SuggestionForm
            users={users}
            aiSuggestionsEnabled={aiSuggestionsEnabled}
            isProfessional={isProfessional(org?.plan ?? "essentials")}
            defaultType={defaultType}
          />
        </div>
      </div>
    </div>
  )
}
