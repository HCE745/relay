"use client"

import { MapPin, AlertTriangle, MessageSquare, ClipboardList, Wrench } from "lucide-react"

interface ActionMenuQrCode {
  token:          string
  name:           string
  description:    string | null
  area:           string | null
  enabledActions: string[]
  organization:   { id: string; name: string }
  location:       { id: string; name: string } | null
  asset:          { id: string; name: string } | null
  survey:         { id: string; title: string; status: string } | null
}

const ACTION_META: Record<string, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  ISSUE: {
    label:       "Report an Issue",
    description: "Tell us about a problem that needs attention",
    icon:        <AlertTriangle className="w-6 h-6" />,
    color:       "text-red-500 bg-red-50 border-red-100",
  },
  FEEDBACK: {
    label:       "Leave Feedback",
    description: "Share your experience or suggestions",
    icon:        <MessageSquare className="w-6 h-6" />,
    color:       "text-yellow-500 bg-yellow-50 border-yellow-100",
  },
  SURVEY: {
    label:       "Take a Survey",
    description: "Answer a few quick questions",
    icon:        <ClipboardList className="w-6 h-6" />,
    color:       "text-indigo-500 bg-indigo-50 border-indigo-100",
  },
  ASSET_VIEW: {
    label:       "Asset Info",
    description: "View information about this equipment",
    icon:        <Wrench className="w-6 h-6" />,
    color:       "text-gray-500 bg-gray-50 border-gray-200",
  },
}

// The ?action param uses lowercase-hyphen form; server normalises to UPPERCASE_UNDERSCORE.
// ASSET_VIEW → asset-view, FEEDBACK → feedback, etc.
function actionParam(action: string): string {
  return action.toLowerCase().replace(/_/g, "-")
}

export function QrActionMenu({ qrCode }: { qrCode: ActionMenuQrCode }) {
  const locationStr = [qrCode.location?.name, qrCode.area].filter(Boolean).join(" · ")

  const actions = qrCode.enabledActions.length > 0
    ? qrCode.enabledActions
    : ["ISSUE"]  // fallback — should not normally happen in MENU mode

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
            {qrCode.organization.name}
          </p>
          <h1 className="text-xl font-bold text-gray-900">{qrCode.name}</h1>
          {locationStr && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {locationStr}
            </p>
          )}
          {qrCode.description && (
            <p className="text-sm text-gray-400 mt-2">{qrCode.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-sm font-medium text-gray-500 mb-4">How can we help?</p>
        <div className="space-y-3">
          {actions.map((action) => {
            const meta = ACTION_META[action]
            if (!meta) return null

            const href = `/report/${qrCode.token}?action=${actionParam(action)}`

            // Derive a contextual label for SURVEY (show survey title) and ASSET_VIEW (show asset name)
            const label =
              action === "SURVEY"     && qrCode.survey ? qrCode.survey.title :
              action === "ASSET_VIEW" && qrCode.asset  ? qrCode.asset.name  :
              meta.label

            const desc =
              action === "SURVEY"     && qrCode.survey ? "Answer a few quick questions" :
              action === "ASSET_VIEW" && qrCode.asset  ? `View info for ${qrCode.asset.name}` :
              meta.description

            return (
              <a
                key={action}
                href={href}
                className={`flex items-center gap-4 p-4 rounded-xl border bg-white hover:shadow-sm transition-shadow active:scale-[0.99]`}
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">{qrCode.organization.name}</p>
      </div>
    </div>
  )
}
