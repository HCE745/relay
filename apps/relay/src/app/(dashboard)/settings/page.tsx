import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { OrgSettingsForm } from "@/components/settings/org-settings-form"
import { ChangePasswordForm } from "@/components/settings/change-password-form"
import { ChangeEmailForm } from "@/components/settings/change-email-form"
import { PageAccessManager } from "@/components/settings/page-access-manager"
import { AiSuggestionsPolicyForm, AiSuggestionsUserToggle, AiSuggestionsDisplayToggle, SopPanelsDisplayToggle } from "@/components/settings/ai-suggestions-form"
import { SafetySettingsForm } from "@/components/settings/safety-settings-form"
import { SopSettingsForm } from "@/components/settings/sop-settings-form"
import { ApprovalIntelligenceSettingsForm } from "@/components/settings/approval-intelligence-settings-form"
import { DarkModeToggle } from "@/components/settings/dark-mode-toggle"
import { IssueTemplatesManager } from "@/components/settings/issue-templates-manager"
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form"
import { DEFAULT_ACCESS, type PageAccessConfig, type PageKey } from "@/lib/page-access"
import Link from "next/link"
import { Users, GitBranch, CreditCard, Sliders } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isAdmin = session.role === "ADMIN"
  const [org, currentUser, userSettings, issueTemplates] = await Promise.all([
    isAdmin ? prisma.organization.findUnique({ where: { id: session.organizationId } }) : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: session.userId }, select: { canChangeEmail: true } }),
    prisma.userSettings.findUnique({ where: { userId: session.userId }, select: { aiSuggestionsOn: true, aiSuggestionsCollapsed: true, sopPanelsCollapsed: true, darkMode: true, notificationPrefs: true } }),
    isAdmin ? prisma.issueTemplate.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ])

  // For non-admin: fetch org availability + policy to know if toggle is locked/hidden
  const orgAiInfo = isAdmin
    ? { aiSuggestionsAvailable: org?.aiSuggestionsAvailable ?? false, aiSuggestionsPolicy: org?.aiSuggestionsPolicy ?? "user_choice" }
    : (await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { aiSuggestionsAvailable: true, aiSuggestionsPolicy: true },
      }) ?? { aiSuggestionsAvailable: false, aiSuggestionsPolicy: "user_choice" })

  const aiAvailable = orgAiInfo.aiSuggestionsAvailable
  const orgPolicy = orgAiInfo.aiSuggestionsPolicy
  const aiPolicyLocked = orgPolicy !== "user_choice"
  const aiPolicyForcedValue = orgPolicy === "on_all"

  const pageAccessConfig = (org?.pageAccessConfig ?? null) as PageAccessConfig | null

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 max-w-2xl space-y-6">

        {/* Org settings — ADMIN only */}
        {isAdmin && org && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Organization</h2>
            <p className="text-xs text-gray-400 mb-4">Only admins can change organization settings.</p>
            <OrgSettingsForm org={org} />
          </div>
        )}

        {/* Page visibility by role — ADMIN only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Page Visibility by Role</h2>
            <p className="text-xs text-gray-400 mb-5">
              Control which pages each role can see in their navigation. Employees always see My Submissions and can always submit issues and suggestions via the header buttons.
            </p>
            <PageAccessManager
              initialConfig={pageAccessConfig ?? {}}
              defaultAccess={DEFAULT_ACCESS as Record<string, PageKey[]>}
            />
          </div>
        )}

        {/* Account info — everyone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Your Account</h2>
          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Name</span>
              <span className="text-gray-900 font-medium">{session.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-900">{session.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-900 font-medium capitalize">{session.role?.toLowerCase()}</span>
            </div>
          </div>
          {currentUser?.canChangeEmail && (
            <>
              <h3 className="font-medium text-gray-800 mb-3 text-sm">Change Email</h3>
              <ChangeEmailForm currentEmail={session.email} />
              <div className="my-4 border-t border-gray-100" />
            </>
          )}
          <h3 className="font-medium text-gray-800 mb-3 text-sm">Change Password</h3>
          <ChangePasswordForm />
        </div>

        {/* Subscription — ADMIN only */}
        {isAdmin && (
          <Link
            href="/settings/subscription"
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <CreditCard className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Subscription</p>
                <p className="text-xs text-gray-500">View plan, pricing, and Intelligence Modules</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
        )}

        {/* Employee Types — ADMIN only */}
        {isAdmin && (
          <Link
            href="/settings/employee-types"
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Users className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Employee Types</p>
                <p className="text-xs text-gray-500">Define role presets with default permissions and page access</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
        )}

        {/* Workspace Customization — ADMIN only */}
        {isAdmin && (
          <Link
            href="/settings/workspace"
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Sliders className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Workspace</p>
                <p className="text-xs text-gray-500">Customize navigation labels and terminology across your workspace</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
        )}

        {/* Routing Rules — ADMIN and MANAGER */}
        {(isAdmin || session.role === "MANAGER") && (
          <Link
            href="/settings/routing"
            className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <GitBranch className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Routing Rules</p>
                <p className="text-xs text-gray-500">Configure how issues are automatically assigned when submitted</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
        )}

        {/* AI Suggestions org policy — ADMIN only, and only when feature is available */}
        {isAdmin && aiAvailable && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">AI Suggestions Policy</h2>
            <p className="text-xs text-gray-400 mb-4">
              Control whether users see AI-powered resolution tips when submitting issues.
            </p>
            <AiSuggestionsPolicyForm
              initialPolicy={org?.aiSuggestionsPolicy ?? "user_choice"}
              initialAudience={org?.aiSuggestionsAudience ?? "both"}
            />
          </div>
        )}

        {/* AI Suggestions personal toggle + display default — display toggle always visible */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Preferences</h2>
          <div className="space-y-5">
            {aiAvailable && (
              <>
                <AiSuggestionsUserToggle
                  initialOn={userSettings?.aiSuggestionsOn ?? true}
                  policyLocked={aiPolicyLocked}
                  forcedValue={aiPolicyForcedValue}
                />
                <div className="border-t border-gray-100 pt-5" />
              </>
            )}
            <AiSuggestionsDisplayToggle
              initialCollapsed={userSettings?.aiSuggestionsCollapsed ?? false}
            />
            <div className="border-t border-gray-100 pt-5 mt-5" />
            <SopPanelsDisplayToggle
              initialCollapsed={userSettings?.sopPanelsCollapsed ?? false}
            />
            <div className="border-t border-gray-100 pt-5 mt-5" />
            <DarkModeToggle initialDarkMode={userSettings?.darkMode ?? false} />
          </div>
        </div>

        {/* Notification Preferences — everyone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Notification Preferences</h2>
          <p className="text-xs text-gray-400 mb-5">
            Choose how you&apos;re notified for each event type.
          </p>
          <NotificationPrefsForm initialPrefs={userSettings?.notificationPrefs ?? {}} />
        </div>

        {/* Issue Templates — ADMIN only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <IssueTemplatesManager templates={issueTemplates} />
          </div>
        )}

        {/* Safety & Purchase Request settings — ADMIN only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Safety & Purchasing</h2>
            <p className="text-xs text-gray-400 mb-5">
              Configure purchase request approval limits and injury report notification contacts.
            </p>
            <SafetySettingsForm
              purchaseRequestEnabled={org?.purchaseRequestEnabled ?? false}
              purchaseRequestItemLimit={org?.purchaseRequestItemLimit ?? null}
              purchaseRequestMonthlyLimit={org?.purchaseRequestMonthlyLimit ?? null}
              injuryAlertEmails={Array.isArray(org?.injuryAlertEmails) ? org.injuryAlertEmails as string[] : []}
            />
          </div>
        )}

        {/* Approval Intelligence settings — ADMIN only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Approval Intelligence</h2>
            <p className="text-xs text-gray-400 mb-5">
              AI-powered purchase request routing. Employees describe what they need, AI identifies the item, matches your catalog, and applies company policy automatically.
            </p>
            <ApprovalIntelligenceSettingsForm
              enabled={org?.approval_intelligence_enabled ?? false}
              aiSuggestUnmatched={org?.ai_suggest_unmatched_items ?? false}
              confidenceThreshold={org?.ai_confidence_threshold ?? 0.8}
            />
          </div>
        )}

        {/* SOP matching settings — ADMIN only */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">SOP Matching</h2>
            <p className="text-xs text-gray-400 mb-5">
              Control how confidently the AI must match a Standard Operating Procedure to a new issue before linking it automatically.
            </p>
            <SopSettingsForm currentSensitivity={org?.sopMatchSensitivity ?? "MEDIUM"} />
          </div>
        )}

        {/* Escalation info — everyone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Escalation Rules</h2>
          <p className="text-sm text-gray-500">
            Issues escalate automatically when they remain unresolved. The default escalation window is 24 hours per level.
          </p>
          <div className="mt-4 space-y-2">
            {[
              { level: 1, color: "bg-blue-100 text-blue-700", label: "Employee → Supervisor (24 hours)" },
              { level: 2, color: "bg-yellow-100 text-yellow-700", label: "Supervisor → Manager (48 hours)" },
              { level: 3, color: "bg-orange-100 text-orange-700", label: "Manager → Regional Manager (72 hours)" },
              { level: 4, color: "bg-red-100 text-red-700", label: "Regional Manager → Executive (96 hours)" },
            ].map(({ level, color, label }) => (
              <div key={level} className="flex items-center gap-3 text-sm text-gray-600">
                <span className={`w-6 h-6 rounded-full ${color} flex items-center justify-center font-bold text-xs`}>{level}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
