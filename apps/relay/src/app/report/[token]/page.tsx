import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { QrReportForm } from "./qr-report-form"
import { QrFeedbackForm } from "./qr-feedback-form"
import { QrActionMenu } from "./qr-action-menu"

export const dynamic = "force-dynamic"

// Maps legacy reportingMode values to the unified action type vocabulary.
const REPORTINGMODE_TO_ACTION: Record<string, string> = {
  PUBLIC_ISSUE:        "ISSUE",
  EMPLOYEE_REPORTING:  "ISSUE",
  ASSET_REPORTING:     "ISSUE",
  VISITOR_FEEDBACK:    "FEEDBACK",
  SAFETY_REPORTING:    "ISSUE",
}

function resolveDirectAction(qrCode: { enabledActions: string[]; reportingMode: string }): string {
  if (qrCode.enabledActions.length > 0) return qrCode.enabledActions[0]
  return REPORTINGMODE_TO_ACTION[qrCode.reportingMode] ?? "ISSUE"
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getrelay.software"

export default async function ReportPage({
  params,
  searchParams,
}: {
  params:       Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const { token }  = await params
  const { action: actionRaw } = await searchParams
  // Normalize action param: "asset-view" → "ASSET_VIEW", "feedback" → "FEEDBACK", etc.
  const actionParam = actionRaw ? actionRaw.toUpperCase().replace(/-/g, "_") : null

  const qrCode = await prisma.qrCode.findUnique({
    where: { token },
    include: {
      location:     { select: { id: true, name: true } },
      department:   { select: { id: true, name: true } },
      asset:        { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, industry: true } },
      survey:       { select: { id: true, title: true, status: true } },
    },
  })

  if (!qrCode || !qrCode.isActive) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Link No Longer Active</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            This reporting link is no longer active. Please contact the facility staff for assistance or look for an updated QR code.
          </p>
        </div>
      </div>
    )
  }

  const isCarWash      = qrCode.organization.industry === "Car Wash"
  const isPropMgmt     = qrCode.organization.industry === "Property Management"
  const isManufacturing = qrCode.organization.industry === "Manufacturing"

  // ── MENU mode with no action selected → show the action picker ───────────
  if (qrCode.presentationMode === "MENU" && !actionParam) {
    return (
      <QrActionMenu
        qrCode={{
          token:        qrCode.token,
          name:         qrCode.name,
          description:  qrCode.description,
          enabledActions: qrCode.enabledActions,
          organization: qrCode.organization,
          location:     qrCode.location,
          area:         qrCode.area,
          asset:        qrCode.asset,
          survey:       qrCode.survey,
        }}
      />
    )
  }

  // ── Determine the active action ───────────────────────────────────────────
  // In MENU mode the ?action param is set by the user's selection.
  // In DIRECT mode (or legacy codes) we derive it from config.
  const action = actionParam ?? resolveDirectAction(qrCode)

  // ── SURVEY action → redirect to the survey (requires Relay login) ─────────
  if (action === "SURVEY") {
    if (qrCode.surveyId) {
      redirect(`${APP_URL}/surveys/${qrCode.surveyId}`)
    }
    // surveyId missing — fall through to issue form
  }

  // ── FEEDBACK action ───────────────────────────────────────────────────────
  if (action === "FEEDBACK") {
    return (
      <QrFeedbackForm
        qrCode={{
          id:           qrCode.id,
          token:        qrCode.token,
          name:         qrCode.name,
          description:  qrCode.description,
          area:         qrCode.area,
          location:     qrCode.location,
          organization: qrCode.organization,
          // Pass back URL for menu codes so the user can return to the menu
          menuUrl:      qrCode.presentationMode === "MENU" ? `/report/${qrCode.token}` : null,
        }}
      />
    )
  }

  // ── ASSET_VIEW action — read-only asset info card ─────────────────────────
  if (action === "ASSET_VIEW" && qrCode.asset) {
    const locationStr = [qrCode.location?.name, qrCode.area].filter(Boolean).join(" · ")
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">{qrCode.organization.name}</p>
            <h1 className="text-xl font-bold text-gray-900">{qrCode.asset.name}</h1>
            {locationStr && <p className="text-sm text-gray-500 mt-1">{locationStr}</p>}
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Asset</p>
              <p className="text-sm text-gray-900 font-medium">{qrCode.asset.name}</p>
            </div>
            {qrCode.location && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</p>
                <p className="text-sm text-gray-900">{qrCode.location.name}{qrCode.area ? ` · ${qrCode.area}` : ""}</p>
              </div>
            )}
            {qrCode.description && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700">{qrCode.description}</p>
              </div>
            )}
          </div>
          {qrCode.presentationMode === "MENU" && (
            <a href={`/report/${qrCode.token}`} className="block w-full text-center text-sm text-indigo-600 py-3">
              ← Back to menu
            </a>
          )}
          <p className="text-xs text-gray-400 text-center">{qrCode.organization.name}</p>
        </div>
      </div>
    )
  }

  // ── ISSUE action (default, legacy, or explicit) ───────────────────────────
  return (
    <QrReportForm
      isCarWash={isCarWash}
      isPropMgmt={isPropMgmt}
      isManufacturing={isManufacturing}
      menuUrl={qrCode.presentationMode === "MENU" ? `/report/${qrCode.token}` : null}
      qrCode={{
        id:                qrCode.id,
        token:             qrCode.token,
        name:              qrCode.name,
        description:       qrCode.description,
        reportingMode:     qrCode.reportingMode,
        area:              qrCode.area,
        defaultCategory:   qrCode.defaultCategory,
        allowedCategories: qrCode.allowedCategories,
        collectContactInfo: qrCode.collectContactInfo,
        requireContactInfo: qrCode.requireContactInfo,
        requirePhoto:       qrCode.requirePhoto,
        location:           qrCode.location,
        department:         qrCode.department,
        asset:              qrCode.asset,
        organization:       qrCode.organization,
      }}
    />
  )
}
