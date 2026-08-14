import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_COLOR, STATUS_COLOR, ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { IssueActions } from "@/components/issues/issue-actions"
import { IssueComments } from "@/components/issues/issue-comments"
import { IssueChat } from "@/components/issues/issue-chat"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { ArrowLeft, MapPin, Building2, Package, Wrench, User, Clock, ChevronUp, Paperclip, CalendarPlus } from "lucide-react"
import { cookies } from "next/headers"
import { NotifyAssigneeButton } from "@/components/issues/notify-assignee-button"
import { VendorDispatchButton } from "@/components/issues/vendor-dispatch-button"
import { IssueSuggestions } from "@/components/issues/issue-suggestions"
import { SopLinkPanel } from "@/components/issues/sop-link-panel"
import { CopyLink } from "@/components/ui/copy-link"
import { RecentlyViewedTracker } from "@/components/layout/recently-viewed-tracker"

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  const { id } = await params

  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      reportedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      location: true,
      department: true,
      asset: true,
      vendor: true,
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      history: { orderBy: { createdAt: "desc" }, take: 20 },
      escalations: { orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      sop: { select: { id: true, title: true } },
    },
  })

  if (!issue) notFound()

  const [org, userSettings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true, aiSuggestionsAvailable: true, aiSuggestionsPolicy: true, aiSuggestionsAudience: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { aiSuggestionsOn: true, aiSuggestionsCollapsed: true, sopPanelsCollapsed: true },
    }),
  ])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  const gcalUrl = (() => {
    if (!issue!.dueDate) return null
    const d = new Date(issue!.dueDate)
    const fmt = (dt: Date) => dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    const end = new Date(d.getTime() + 3600000)
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `[Relay] ${issue!.title}`,
      dates: `${fmt(d)}/${fmt(end)}`,
      details: issue!.description ?? "",
      sprop: `website:${baseUrl}`,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  })()

  const orgUsers = await prisma.user.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    select: { id: true, name: true, role: true, email: true, department: { select: { name: true } }, location: { select: { name: true } } },
    orderBy: { name: "asc" },
  })

  const canLinkSOP = ["ADMIN", "MANAGER"].includes(session.role)

  const [orgVendors, availableSOPs] = await Promise.all([
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    canLinkSOP
      ? prisma.sOP.findMany({
          where: { organizationId: session.organizationId, isActive: true },
          select: { id: true, title: true, category: true },
          orderBy: { title: "asc" },
        })
      : Promise.resolve([]),
  ])

  const images = issue.attachments.filter(a => a.mimeType.startsWith("image/"))
  const videos = issue.attachments.filter(a => a.mimeType.startsWith("video/"))

  // Cookies take precedence over DB for collapsed prefs (handles bfcache and cross-session freshness)
  const cookieStore = await cookies()
  const aiCookie = cookieStore.get("relay_panels_collapsed")
  const sopCookie = cookieStore.get("relay_sop_panels_collapsed")
  const defaultCollapsed = aiCookie
    ? aiCookie.value === "1"
    : (userSettings?.aiSuggestionsCollapsed ?? false)
  const defaultSopCollapsed = sopCookie
    ? sopCookie.value === "1"
    : (userSettings?.sopPanelsCollapsed ?? false)

  // Determine which AI suggestions this user should see
  const aiPolicy = org?.aiSuggestionsPolicy ?? "user_choice"
  const aiEnabled =
    !!org?.aiSuggestionsAvailable &&
    (aiPolicy === "on_all" || (aiPolicy === "user_choice" && (userSettings?.aiSuggestionsOn ?? true)))

  const audience = org?.aiSuggestionsAudience ?? "both"
  const isSubmitter = issue.reportedBy.id === session.userId
  const isAssignee = issue.assignedTo?.id === session.userId
  const isAdminOrManager = ["ADMIN", "HR", "MANAGER"].includes(session.role)

  return (
    <div>
      <RecentlyViewedTracker item={{
        id: issue.id,
        title: issue.title,
        type: "issue",
        status: issue.status,
        href: `/issues/${issue.id}`,
      }} />
      <Header
        title=""
        actions={
          <Link href="/issues" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Back to Issues
          </Link>
        }
      />

      <div className="p-6 max-w-5xl" data-tour="issue-detail">
        {/* Issue Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4" data-tour="issue-detail-header">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge className={PRIORITY_COLOR[issue.priority]}>
                  {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                </Badge>
                <Badge className={STATUS_COLOR[issue.status]}>
                  {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                </Badge>
                {issue.isEscalated && (
                  <Badge className="bg-red-50 text-red-700 border-red-200">
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Escalated (Level {issue.escalationLevel})
                  </Badge>
                )}
                <span className="text-xs text-gray-400">
                  {ISSUE_CATEGORY[issue.category as keyof typeof ISSUE_CATEGORY] ?? issue.category}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <h2 className="text-xl font-bold text-gray-900 flex-1">{issue.title}</h2>
                <CopyLink url={`${baseUrl}/issues/${issue.id}`} className="mt-0.5 flex-shrink-0" />
              </div>
              {issue.description && (
                <p className="mt-2 text-gray-600 text-sm whitespace-pre-wrap">{issue.description}</p>
              )}
            </div>
            <IssueActions issue={issue} users={orgUsers.map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email, department: u.department?.name ?? undefined, location: u.location?.name ?? undefined }))} vendors={orgVendors} sessionRole={session.role} />
          </div>

          {/* Attachments */}
          {issue.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <Paperclip className="w-3.5 h-3.5" />
                {issue.attachments.length} attachment{issue.attachments.length !== 1 ? "s" : ""}
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((att) => (
                  <a key={att.id} href={`/api/attachments/view?url=${encodeURIComponent(att.url)}`} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/attachments/view?url=${encodeURIComponent(att.url)}`}
                      alt={att.filename}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
                {videos.map((att) => (
                  <div key={att.id} className="relative">
                    <video
                      src={`/api/attachments/view?url=${encodeURIComponent(att.url)}`}
                      controls
                      className="h-24 rounded-lg border border-gray-200 bg-black"
                      preload="metadata"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-400">Reported by</div>
                <div className="text-sm text-gray-700">{issue.reportedBy.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-400">Assigned to</div>
                <div className="text-sm text-gray-700">{issue.assignedTo?.name ?? "Unassigned"}</div>
                {issue.assignedTo?.email && (
                  <div className="mt-1">
                    <NotifyAssigneeButton
                      issueId={issue.id}
                      assigneeName={issue.assignedTo.name}
                      assigneeEmail={issue.assignedTo.email}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-400">Created</div>
                <div className="text-sm text-gray-700">{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</div>
              </div>
            </div>
            {issue.dueDate && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Due date</div>
                  <div className="text-sm text-gray-700">{format(new Date(issue.dueDate), "MMM d, yyyy")}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {gcalUrl && (
                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        Add to Google Calendar
                      </a>
                    )}
                    <a
                      href={`/api/issues/${issue.id}/ics`}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <CalendarPlus className="w-3 h-3" />
                      Download .ics
                    </a>
                  </div>
                </div>
              </div>
            )}
            {issue.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Location</div>
                  <div className="text-sm text-gray-700">{issue.location.name}</div>
                </div>
              </div>
            )}
            {issue.department && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Department</div>
                  <div className="text-sm text-gray-700">{issue.department.name}</div>
                </div>
              </div>
            )}
            {issue.asset && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Asset</div>
                  <Link href={`/assets/${issue.asset.id}`} className="text-sm text-blue-600 hover:underline">
                    {issue.asset.name}
                  </Link>
                </div>
              </div>
            )}
            {issue.vendor && (
              <div className="flex items-center gap-2" data-tour="vendor-dispatch">
                <Wrench className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Vendor</div>
                  <div className="text-sm text-gray-700">{issue.vendor.name}</div>
                  <div className="mt-1">
                    <VendorDispatchButton
                      issueId={issue.id}
                      vendorId={issue.vendor.id}
                      orgName={org?.name ?? ""}
                      vendorEmail={issue.vendor.email ?? null}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual SOP linking — admin/manager only */}
        {canLinkSOP && (
          <div className="mb-4" data-tour="sop-panel">
            <SopLinkPanel
              issueId={issue.id}
              currentSopId={issue.sopId ?? null}
              currentSopTitle={issue.sop?.title ?? null}
              currentSopLinkSource={issue.sopLinkSource ?? null}
              sopMatchConfidence={issue.sopMatchConfidence ?? null}
              availableSOPs={availableSOPs}
              defaultCollapsed={defaultSopCollapsed}
            />
          </div>
        )}

        {/* AI suggestions + SOP violation callout (SOP callout shows even when AI is off) */}
        <div data-tour="ai-panel">
        <IssueSuggestions
          issueId={issue.id}
          initialSubmitterSuggestion={issue.submitterSuggestion ?? null}
          initialAssigneeSuggestion={issue.assigneeSuggestion ?? null}
          showSubmitter={aiEnabled && (audience === "submitter_only" || audience === "both") && (isSubmitter || isAdminOrManager)}
          showAssignee={aiEnabled && (audience === "assignee_only" || audience === "both") && (isAssignee || isAdminOrManager)}
          isSubmitter={isSubmitter}
          isAssignee={isAssignee}
          isAdminOrManager={isAdminOrManager}
          defaultCollapsed={defaultCollapsed}
          defaultSopCollapsed={defaultSopCollapsed}
          sopId={issue.sopId ?? null}
          sopTitle={issue.sop?.title ?? null}
          sopViolation={issue.sopViolation}
          sopMatchConfidence={issue.sopMatchConfidence ?? null}
          sopViolationNote={issue.sopViolationNote ?? null}
          sopLinkSource={issue.sopLinkSource ?? null}
        />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Comments + Internal Chat */}
          <div className="lg:col-span-2 space-y-4">
            <IssueComments
              issueId={issue.id}
              comments={issue.comments}
              currentUserId={session.userId}
              orgUsers={orgUsers.map(u => ({ id: u.id, name: u.name }))}
            />
            <IssueChat
              issueId={issue.id}
              currentUserId={session.userId}
              currentUserName={session.name}
            />
          </div>

          {/* Activity / History */}
          <div className="bg-white rounded-xl border border-gray-200 p-4" data-tour="escalation-timeline">
            <h3 className="font-medium text-gray-900 mb-3 text-sm">Activity Log</h3>
            <div className="space-y-2">
              {issue.escalations.map((esc) => (
                <div key={esc.id} className="text-xs text-gray-500 border-l-2 border-red-300 pl-2 py-1">
                  <div className="font-medium text-red-600">Escalated to Level {esc.toLevel}</div>
                  {esc.reason && <div>{esc.reason}</div>}
                  <div className="text-gray-400">{formatDistanceToNow(new Date(esc.createdAt), { addSuffix: true })}</div>
                </div>
              ))}
              {issue.history.map((h) => (
                <div key={h.id} className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2 py-1">
                  <div className="font-medium text-gray-700 capitalize">{h.field.replace(/([A-Z])/g, " $1").toLowerCase()} changed</div>
                  {h.oldValue && h.newValue && (
                    <div>{h.oldValue} → {h.newValue}</div>
                  )}
                  <div className="text-gray-400">{formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}</div>
                </div>
              ))}
              {issue.history.length === 0 && issue.escalations.length === 0 && (
                <p className="text-xs text-gray-400">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
