"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp, TrendingDown, AlertTriangle, Zap, RefreshCw,
  CheckCircle, Clock, Loader2, ChevronDown, ChevronUp,
} from "lucide-react"

interface Alert {
  id: string
  trendType: string
  title: string
  description: string
  severity: string
  supportingData: Record<string, unknown>
  recommendation: string | null
  status: string
  detectedAt: string
}

interface Props {
  orgId: string
  initialAlerts: Alert[]
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}

const TREND_ICON: Record<string, React.ElementType> = {
  VOLUME_SPIKE:       TrendingUp,
  VOLUME_DROP:        TrendingDown,
  SAFETY_INCREASE:    AlertTriangle,
  RECURRING_ASSET:    RefreshCw,
  RECURRING_LOCATION: RefreshCw,
  SLOW_RESOLUTION:    Clock,
  CATEGORY_TREND:     TrendingUp,
}

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded]   = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const Icon = TREND_ICON[alert.trendType] ?? Zap
  const isDismissed = alert.status === "DISMISSED"

  async function dismiss() {
    setDismissing(true)
    try {
      await fetch(`/api/trend-detection/${alert.id}/dismiss`, { method: "POST" })
      onDismiss(alert.id)
    } finally { setDismissing(false) }
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border rounded-xl p-5 transition-opacity ${isDismissed ? "opacity-50" : ""} ${
      alert.severity === "HIGH" ? "border-red-200 dark:border-red-900" :
      alert.severity === "MEDIUM" ? "border-amber-200 dark:border-amber-900" :
      "border-gray-200 dark:border-gray-700"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${
            alert.severity === "HIGH"   ? "bg-red-100 dark:bg-red-900/30" :
            alert.severity === "MEDIUM" ? "bg-amber-100 dark:bg-amber-900/30" :
                                          "bg-blue-100 dark:bg-blue-900/30"
          }`}>
            <Icon className={`w-4 h-4 ${
              alert.severity === "HIGH"   ? "text-red-600 dark:text-red-400" :
              alert.severity === "MEDIUM" ? "text-amber-600 dark:text-amber-400" :
                                            "text-blue-600 dark:text-blue-400"
            }`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[alert.severity]}`}>
                {alert.severity}
              </span>
              {isDismissed && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  Dismissed
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mt-1">{alert.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{alert.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isDismissed && (
            <button
              onClick={dismiss}
              disabled={dismissing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              {dismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Dismiss
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          {alert.recommendation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Recommended Action</p>
              <p className="text-sm text-blue-800 dark:text-blue-300">{alert.recommendation}</p>
            </div>
          )}
          <p className="text-xs text-gray-400">
            Detected {new Date(alert.detectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}
    </div>
  )
}

export function TrendAlertsClient({ orgId, initialAlerts }: Props) {
  const router = useRouter()
  const [alerts, setAlerts]         = useState(initialAlerts)
  const [running, setRunning]       = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)

  const activeAlerts    = alerts.filter(a => a.status === "ACTIVE")
  const dismissedAlerts = alerts.filter(a => a.status === "DISMISSED")

  function handleDismiss(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "DISMISSED" } : a))
  }

  async function runDetection() {
    setRunning(true)
    try {
      await fetch("/api/trend-detection/run", { method: "POST" })
      router.refresh()
    } finally { setRunning(false) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeAlerts.length} active {activeAlerts.length === 1 ? "alert" : "alerts"}
            {dismissedAlerts.length > 0 && ` · ${dismissedAlerts.length} dismissed`}
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Run Detection Now
        </button>
      </div>

      {activeAlerts.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No active trends detected</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All operational patterns look normal. Detection runs automatically each day.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {activeAlerts.map(alert => (
          <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
        ))}
      </div>

      {dismissedAlerts.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowDismissed(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showDismissed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDismissed ? "Hide" : "Show"} {dismissedAlerts.length} dismissed {dismissedAlerts.length === 1 ? "alert" : "alerts"}
          </button>
          {showDismissed && (
            <div className="space-y-3 mt-3">
              {dismissedAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
