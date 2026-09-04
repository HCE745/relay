"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import {
  AlertTriangle, CheckCircle, Clock, ExternalLink,
  Loader2, RefreshCw, Server, Zap,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SentryIssue {
  id: string
  title: string
  culprit: string
  shortId: string
  count: number
  userCount: number
  firstSeen: string
  lastSeen: string
  isResolved: boolean
  permalink: string
  level: string
}

interface SentryData {
  configured: boolean
  errors24h: number
  errors7d: number
  activeIssues: number
  issues: SentryIssue[]
}

interface VercelDeployment {
  uid: string
  name: string
  url: string | null
  state: string
  createdAt: number
  readyAt: number | null
  errorMessage: string | null
  commit: string | null
  branch: string | null
  author: string | null
}

interface VercelData {
  configured: boolean
  deployments: VercelDeployment[]
}

// ── Health badge ───────────────────────────────────────────────────────────────

function HealthChip({ count, label }: { count: number; label: string }) {
  const color =
    count === 0  ? "bg-green-900/60 text-green-300 border-green-800"
    : count <= 5 ? "bg-amber-900/60 text-amber-300 border-amber-800"
                 : "bg-red-900/60 text-red-400 border-red-900"
  const Icon  =
    count === 0  ? CheckCircle
    : count <= 5 ? AlertTriangle
                 : AlertTriangle

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-lg font-bold leading-none">{count}</p>
        <p className="text-[11px] opacity-75 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Deployment state badge ─────────────────────────────────────────────────────

function DeployBadge({ state }: { state: string }) {
  const styles: Record<string, string> = {
    READY:        "bg-green-900/60 text-green-300",
    ERROR:        "bg-red-900/60 text-red-400",
    BUILDING:     "bg-blue-900/60 text-blue-300",
    INITIALIZING: "bg-blue-900/60 text-blue-300",
    QUEUED:       "bg-gray-800 text-gray-400",
    CANCELED:     "bg-gray-800 text-gray-500",
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[state] ?? "bg-gray-800 text-gray-400"}`}>
      {state}
    </span>
  )
}

// ── Level badge ────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    fatal:   "bg-red-900/80 text-red-300",
    error:   "bg-orange-900/60 text-orange-300",
    warning: "bg-amber-900/60 text-amber-300",
    info:    "bg-blue-900/60 text-blue-300",
    debug:   "bg-gray-800 text-gray-400",
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${styles[level] ?? styles.error} uppercase tracking-wide`}>
      {level}
    </span>
  )
}

// ── Not configured notice ──────────────────────────────────────────────────────

function NotConfigured({ service, envVars }: { service: string; envVars: string[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-white text-sm font-medium">{service} not configured</p>
        <p className="text-gray-400 text-xs mt-1">
          Set the following environment variables to enable this integration:
        </p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {envVars.map(v => (
            <code key={v} className="text-xs bg-gray-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">{v}</code>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OrgDiagnostics({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [sentry, setSentry]       = useState<SentryData | null>(null)
  const [vercel, setVercel]       = useState<VercelData | null>(null)
  const [sentryLoading, setSentryLoading] = useState(true)
  const [vercelLoading, setVercelLoading] = useState(true)
  const [sentryError, setSentryError]     = useState(false)
  const [vercelError, setVercelError]     = useState(false)

  async function loadSentry() {
    setSentryLoading(true)
    setSentryError(false)
    try {
      const res = await fetch(`/api/super-admin/diagnostics/sentry?orgId=${orgId}`)
      if (res.ok) setSentry(await res.json() as SentryData)
      else setSentryError(true)
    } catch { setSentryError(true) }
    finally  { setSentryLoading(false) }
  }

  async function loadVercel() {
    setVercelLoading(true)
    setVercelError(false)
    try {
      const res = await fetch("/api/super-admin/diagnostics/vercel")
      if (res.ok) setVercel(await res.json() as VercelData)
      else setVercelError(true)
    } catch { setVercelError(true) }
    finally  { setVercelLoading(false) }
  }

  useEffect(() => {
    loadSentry()
    loadVercel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  // ── Health summary ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Health summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Error Health — {orgName}
          </h2>
          <button
            onClick={() => { loadSentry(); loadVercel() }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {sentryLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading Sentry data…
          </div>
        ) : !sentry?.configured ? (
          <NotConfigured service="Sentry" envVars={["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]} />
        ) : sentryError ? (
          <p className="text-red-400 text-sm">Failed to load Sentry data.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <HealthChip count={sentry.errors24h}    label="Issues (24 h)" />
            <HealthChip count={sentry.errors7d}     label="Issues (7 d)"  />
            <HealthChip count={sentry.activeIssues} label="Active / unresolved" />
          </div>
        )}
      </div>

      {/* Sentry error feed */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Recent Sentry Errors</h2>
          <span className="text-xs text-gray-500">filtered to organization_id: {orgId}</span>
        </div>

        {sentryLoading ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          </div>
        ) : !sentry?.configured ? null : sentryError ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-red-400 text-sm">
            Failed to fetch from Sentry API. Check SENTRY_AUTH_TOKEN is valid.
          </div>
        ) : sentry.issues.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-gray-300 text-sm font-medium">No active errors for this organization</p>
            <p className="text-gray-500 text-xs mt-1">
              Errors will appear here once tagged with organization_id:{orgId}
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
            {sentry.issues.map(issue => (
              <div key={issue.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <LevelBadge level={issue.level} />
                      <span className="text-gray-600 text-[10px] font-mono">{issue.shortId}</span>
                    </div>
                    <p className="text-white text-sm font-medium leading-snug">{issue.title}</p>
                    {issue.culprit && (
                      <p className="text-gray-500 text-xs mt-0.5 font-mono truncate">{issue.culprit}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      <span title="Total occurrences">
                        {issue.count.toLocaleString()} event{issue.count !== 1 ? "s" : ""}
                      </span>
                      {issue.userCount > 0 && (
                        <span>{issue.userCount} user{issue.userCount !== 1 ? "s" : ""} affected</span>
                      )}
                      <span title="First seen">
                        First: {formatDistanceToNowStrict(new Date(issue.firstSeen), { addSuffix: true })}
                      </span>
                      <span title="Last seen">
                        Last: {formatDistanceToNowStrict(new Date(issue.lastSeen), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <a
                    href={issue.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-indigo-400 transition-colors"
                    title="Open in Sentry"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vercel deployment status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Recent Vercel Deployments</h2>
          <span className="text-xs text-gray-500">platform-wide (all orgs share one deployment)</span>
        </div>

        {vercelLoading ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          </div>
        ) : !vercel?.configured ? (
          <NotConfigured service="Vercel" envVars={["VERCEL_TOKEN", "VERCEL_PROJECT_ID"]} />
        ) : vercelError ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-red-400 text-sm">
            Failed to fetch from Vercel API. Check VERCEL_TOKEN is valid.
          </div>
        ) : vercel.deployments.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-gray-500 text-sm">
            No recent deployments found.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
            {vercel.deployments.map((d, i) => (
              <div key={d.uid} className={`p-4 ${i === 0 ? "bg-gray-800/30" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <DeployBadge state={d.state} />
                      {i === 0 && <span className="text-[10px] text-gray-500 font-medium">latest</span>}
                      {d.branch && (
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                          {d.branch}
                        </span>
                      )}
                    </div>
                    {d.commit && (
                      <p className="text-gray-300 text-xs leading-snug truncate">{d.commit}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNowStrict(new Date(d.createdAt), { addSuffix: true })}
                      </span>
                      {d.author && <span>{d.author}</span>}
                      {d.errorMessage && (
                        <span className="text-red-400">{d.errorMessage}</span>
                      )}
                    </div>
                  </div>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-indigo-400 transition-colors"
                      title="Open deployment"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
