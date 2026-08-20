import Link from "next/link"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { ImpersonationBanner } from "@/components/super-admin/impersonation-banner"
import { DemoTourHost } from "@/components/demo/demo-tour-host"
import { PushRegistration } from "@/components/native/push-registration"
import { OfflineBanner } from "@/components/native/offline-banner"
import { StatusBarConfig } from "@/components/native/status-bar-config"
import { GlobalSearch } from "@/components/layout/global-search"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { DarkModeProvider } from "@/components/layout/dark-mode-provider"
import { SentryOrgContext } from "@/components/layout/sentry-org-context"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getAccessConfig, type PageAccessConfig } from "@/lib/page-access"
import { setOrgContext } from "@/lib/sentry"
import { Clock, AlertTriangle } from "lucide-react"
import { isReadOnly, isWashEssentials } from "@/lib/pricing"
import { ReadOnlyProvider } from "@/components/layout/read-only-context"
import { TermsUpdateModal } from "@/components/legal/terms-update-modal"
import { LegalFooter } from "@/components/legal/legal-footer"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const [org, userSettings, latestAcceptance] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        pageAccessConfig: true,
        name: true,
        subscriptionStatus: true,
        plan: true,
        productLine: true,
        industry: true,
        intelligenceModules: true,
        intelligenceSuiteEnabled: true,
        regions_enabled: true,
        corporate_dashboard_enabled: true,
        cross_location_analytics_enabled: true,
        advanced_escalations_enabled: true,
        api_webhooks_enabled: true,
        sso_foundation_enabled: true,
        shared_facility_enabled: true,
        executive_briefings_enabled: true,
        executive_goals_enabled: true,
        trend_detection_enabled: true,
        navigationConfig: true,
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { darkMode: true },
    }),
    prisma.legalAcceptance.findFirst({
      where:   { userId: session.userId },
      orderBy: { acceptedAt: "desc" },
      select:  { termsVersion: true, privacyVersion: true },
    }),
  ])

  const needsTermsUpdate =
    !session.isDemo &&
    (
      !latestAcceptance ||
      latestAcceptance.termsVersion   !== CURRENT_TERMS_VERSION ||
      latestAcceptance.privacyVersion !== CURRENT_PRIVACY_VERSION
    )

  if (org?.name) setOrgContext(session.organizationId, org.name)

  const navLabelOverrides = ((org?.navigationConfig ?? {}) as { labelOverrides?: Record<string, string> }).labelOverrides ?? {}

  // Use DB status as source of truth (fresher than JWT for expired/read_only)
  const currentStatus = org?.subscriptionStatus ?? session.subscriptionStatus ?? "trialing"
  const readOnly = isReadOnly(currentStatus)

  const storedConfig = (org?.pageAccessConfig ?? null) as PageAccessConfig | null
  const basePageKeys = getAccessConfig(session.role, storedConfig)

  // Wash Essentials hides features that are out of scope for the car-wash product
  const WASH_ESSENTIALS_HIDDEN: Set<string> = new Set([
    "departments", "sops", "purchase-requests", "approval-intelligence",
  ])
  const allowedPageKeys = isWashEssentials(session.productLine)
    ? basePageKeys.filter(k => !WASH_ESSENTIALS_HIDDEN.has(k))
    : basePageKeys
  const cookieStore = await cookies()
  // relay-vd: set by /demo-video page for iframe recording
  // relay-vm: set by middleware when ?videomode=true is in the URL
  const videoMode = cookieStore.get("relay-vd")?.value === "1" || cookieStore.get("relay-vm")?.value === "1"

  const showRouting = ["ADMIN", "MANAGER"].includes(session.role)

  // Trial banner — read from JWT (no extra DB query)
  const trialEndsAt = session.trialEndsAt ? new Date(session.trialEndsAt) : null
  const isTrialing  = currentStatus === "trialing" && trialEndsAt && trialEndsAt > new Date()
  const daysLeft    = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  // Blue 14-7d, yellow 6-3d, red 2-0d
  const bannerColor =
    daysLeft === null        ? "blue"
    : daysLeft >= 7          ? "blue"
    : daysLeft >= 3          ? "yellow"
                             : "red"

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      {/* Impersonation banner — shown when a super admin is viewing as an org admin */}
      {session.impersonatedBy && (
        <ImpersonationBanner
          superAdminName={session.impersonatedByName ?? "Super Admin"}
          orgName={session.impersonatedOrgName ?? "this organization"}
        />
      )}
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar
        allowedPageKeys={allowedPageKeys}
        showRouting={showRouting}
        industry={org?.industry ?? undefined}
        corporateDashboardEnabled={org?.corporate_dashboard_enabled ?? false}
        regionsEnabled={org?.regions_enabled ?? false}
        apiWebhooksEnabled={org?.api_webhooks_enabled ?? false}
        ssoEnabled={org?.sso_foundation_enabled ?? false}
        sharedFacilityEnabled={org?.shared_facility_enabled ?? false}
        executiveBriefingsEnabled={org?.executive_briefings_enabled ?? false}
        executiveGoalsEnabled={org?.executive_goals_enabled ?? false}
        trendDetectionEnabled={org?.trend_detection_enabled ?? false}
        navLabelOverrides={navLabelOverrides}
      />

      {/* Mobile: top bar + slide-out drawer + bottom tab bar */}
      <MobileNav
        allowedPageKeys={allowedPageKeys}
        showRouting={showRouting}
        industry={org?.industry ?? undefined}
        corporateDashboardEnabled={org?.corporate_dashboard_enabled ?? false}
        regionsEnabled={org?.regions_enabled ?? false}
        userName={session.name ?? ""}
        orgName={org?.name ?? ""}
        navLabelOverrides={navLabelOverrides}
      />

      {/* Content area: right of sidebar on desktop, full-width on mobile */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-0 overflow-hidden">
        {/* Trial banner — hidden in demo and video mode */}
        {isTrialing && !session.isDemo && !videoMode && (
          <div
            className={`shrink-0 px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${
              bannerColor === "red"
                ? "bg-red-600 text-white"
                : bannerColor === "yellow"
                ? "bg-amber-50 border-b border-amber-200 text-amber-900"
                : "bg-blue-50 border-b border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className={`w-4 h-4 shrink-0 ${
                bannerColor === "red" ? "text-red-200" : bannerColor === "yellow" ? "text-amber-500" : "text-blue-500"
              }`} />
              <span className="truncate">
                {daysLeft === 0
                  ? "Your free trial expires today."
                  : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.`}
              </span>
            </div>
            {session.role === "ADMIN" && (
              <Link
                href="/subscribe"
                className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                  bannerColor === "red"
                    ? "bg-white text-red-700 hover:bg-red-50"
                    : bannerColor === "yellow"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Upgrade Now
              </Link>
            )}
          </div>
        )}

        {/* Expired / read-only banner — hidden in demo and video mode */}
        {readOnly && !session.isDemo && !videoMode && (
          <div className="shrink-0 px-4 py-3 bg-red-600 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-200" />
              <span className="text-sm font-medium truncate">
                Your trial has expired. Your data is safe — subscribe to restore full access.
              </span>
            </div>
            {session.role === "ADMIN" && (
              <Link
                href="/subscribe"
                className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-full transition-colors"
              >
                Subscribe Now
              </Link>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto overscroll-y-contain flex flex-col">
          <div
            className="md:hidden shrink-0"
            style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }}
          />

          <div className="flex-1">
            <ReadOnlyProvider readOnly={readOnly}>
              {children}
            </ReadOnlyProvider>
          </div>

          <div
            className="md:hidden shrink-0"
            style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
          />

          <LegalFooter />
        </main>
      </div>

      <InstallPrompt />
      {session.isDemo && !videoMode && (
        <DemoTourHost
          currentRole={session.role}
          plan={org?.plan ?? "pro"}
          intelligenceModules={(org?.intelligenceModules ?? []) as string[]}
          initialIndustry={org?.industry ?? "Manufacturing"}
        />
      )}
      {needsTermsUpdate && <TermsUpdateModal />}
      <GlobalSearch />
      <KeyboardShortcuts isDemoMode={session.isDemo} />
      <DarkModeProvider darkMode={userSettings?.darkMode ?? false} />
      <SentryOrgContext orgId={session.organizationId} orgName={org?.name ?? ""} />
      {/* Native app utilities — no-op in browsers */}
      <PushRegistration />
      <StatusBarConfig />
      <OfflineBanner />
      </div>
    </div>
  )
}
