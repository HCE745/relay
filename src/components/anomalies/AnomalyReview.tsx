"use client"
import { useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"

type AnomalyFlag = {
  id: string
  tenantId: string
  entityId: string
  sourceType: string
  sourceId: string
  reason: string
  severity: "LOW" | "MEDIUM" | "HIGH"
  ruleType: string
  status: "OPEN" | "DISMISSED"
  dismissedAt: string | null
  dismissedBy: string | null
  createdAt: string
}

type Props = {
  initialFlags: AnomalyFlag[]
  entityId: string
}

type SeverityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW"

const SEVERITY_BADGE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-orange-100 text-orange-700",
  LOW: "bg-yellow-100 text-yellow-700",
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function sourceLabel(flag: AnomalyFlag) {
  const type = flag.sourceType === "INVOICE" ? "Invoice" : "Bill"
  const short = flag.sourceId.slice(0, 8)
  const href = flag.sourceType === "INVOICE" ? `/invoices/${flag.sourceId}` : `/bills/${flag.sourceId}`
  return { type, short, href }
}

export function AnomalyReview({ initialFlags, entityId }: Props) {
  const [flags, setFlags] = useState<AnomalyFlag[]>(initialFlags)
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState<SeverityFilter>("ALL")
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const lastScan =
    flags.length > 0
      ? flags.reduce((latest, f) =>
          f.createdAt > latest.createdAt ? f : latest
        ).createdAt
      : null

  async function handleScan() {
    setScanning(true)
    try {
      const res = await fetch("/api/anomalies/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      })
      if (res.ok) {
        const data = await res.json()
        setFlags(data.flags ?? [])
      }
    } finally {
      setScanning(false)
    }
  }

  async function handleDismiss(id: string) {
    setDismissingId(id)
    try {
      const res = await fetch(`/api/anomalies/${id}/dismiss`, { method: "POST" })
      if (res.ok) {
        setFlags((prev) => prev.filter((f) => f.id !== id))
      }
    } finally {
      setDismissingId(null)
    }
  }

  const filtered =
    filter === "ALL" ? flags : flags.filter((f) => f.severity === filter)

  const tabs: { label: string; value: SeverityFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "High", value: "HIGH" },
    { label: "Medium", value: "MEDIUM" },
    { label: "Low", value: "LOW" },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anomaly Review</h1>
          {lastScan && (
            <p className="text-sm text-gray-500 mt-0.5">
              Last scan: {fmt(lastScan)}
            </p>
          )}
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Scan Now
            </>
          )}
        </button>
      </div>

      {/* Severity filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => {
          const count =
            tab.value === "ALL"
              ? flags.length
              : flags.filter((f) => f.severity === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.value
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Flag list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">
            No anomalies found for this period. Click{" "}
            <button
              onClick={handleScan}
              className="text-blue-600 hover:underline font-medium"
            >
              Scan Now
            </button>{" "}
            to check.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((flag) => {
            const { type, short, href } = sourceLabel(flag)
            return (
              <div
                key={flag.id}
                className="bg-white rounded-xl border border-gray-200 p-6 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE[flag.severity] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {flag.severity}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {flag.ruleType.replace(/_/g, " ")}
                    </span>
                  </div>
                  {/* Reason */}
                  <p className="text-sm text-gray-800">{flag.reason}</p>
                  {/* Source link */}
                  <p className="text-xs text-gray-500">
                    {type}{" "}
                    <Link
                      href={href}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      #{short}
                    </Link>{" "}
                    &mdash; flagged {fmt(flag.createdAt)}
                  </p>
                </div>
                {/* Dismiss button */}
                <button
                  onClick={() => handleDismiss(flag.id)}
                  disabled={dismissingId === flag.id}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {dismissingId === flag.id ? "Dismissing…" : "Dismiss"}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
