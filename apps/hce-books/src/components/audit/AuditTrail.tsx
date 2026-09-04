"use client"
import { useState, useCallback } from "react"
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type AuditLogItem = {
  id: string
  tenantId: string
  entityId: string | null
  userId: string | null
  action: string
  tableName: string
  recordId: string
  beforeJson: unknown
  afterJson: unknown
  createdAt: string
  userName: string
}

type Props = {
  initialLogs: AuditLogItem[]
  entityId: string
  entities: { id: string; name: string }[]
  userId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  "ALL",
  "CREATE",
  "ENTER",
  "SEND",
  "PAY",
  "POST",
  "VOID",
  "CLOSE_PERIOD",
  "VENDOR_CREDIT",
  "CREDIT_MEMO",
  "DISMISS",
] as const

const ACTION_BADGE_CLASS: Record<string, string> = {
  POST: "bg-blue-100 text-blue-700",
  SEND: "bg-blue-100 text-blue-700",
  ENTER: "bg-blue-100 text-blue-700",
  CREATE: "bg-blue-100 text-blue-700",
  PAY: "bg-green-100 text-green-700",
  RECONCILIATION: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
  CANCEL: "bg-red-100 text-red-700",
  CLOSE_PERIOD: "bg-purple-100 text-purple-700",
  DISMISS: "bg-gray-100 text-gray-600",
  VENDOR_CREDIT: "bg-gray-100 text-gray-600",
  CREDIT_MEMO: "bg-gray-100 text-gray-600",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtDate(iso: string) {
  return iso.slice(0, 10)
}

function actionBadge(action: string) {
  const cls = ACTION_BADGE_CLASS[action] ?? "bg-gray-100 text-gray-600"
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {action}
    </span>
  )
}

function toRecord(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>
  }
  return {}
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") {
    // Likely cents — show as dollars
    if (Number.isInteger(v) && Math.abs(v) > 100) {
      return "$" + (v / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
    }
  }
  if (typeof v === "string") {
    // ISO timestamp?
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      return fmtTimestamp(v)
    }
    return v
  }
  return String(v)
}

/** Inline diff summary: up to 3 changed keys shown. */
function diffSummary(before: unknown, after: unknown): string {
  const b = toRecord(before)
  const a = toRecord(after)

  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)])
  const changes: string[] = []

  for (const key of allKeys) {
    const bVal = b[key]
    const aVal = a[key]
    if (String(bVal) !== String(aVal)) {
      if (bVal === undefined) {
        changes.push(`${key}: ${fmtVal(aVal)}`)
      } else if (aVal === undefined) {
        changes.push(`${key}: removed`)
      } else {
        changes.push(`${key}: ${fmtVal(bVal)} → ${fmtVal(aVal)}`)
      }
    }
    if (changes.length >= 3) break
  }

  return changes.length > 0 ? changes.join(" · ") : "no changes"
}

/** CSV export helper (client-safe). */
function toCsvClient(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h]
          const s = v == null ? "" : String(v)
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s
        })
        .join(","),
    ),
  ]
  return lines.join("\n")
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Diff Modal ───────────────────────────────────────────────────────────────

function DiffModal({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  const before = toRecord(log.beforeJson)
  const after = toRecord(log.afterJson)
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Audit Detail
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {log.action} · {log.tableName} · {fmtTimestamp(log.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meta row */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
          <span>User: <strong>{log.userName}</strong></span>
          <span>Record: <strong className="font-mono">{log.recordId}</strong></span>
        </div>

        {/* Diff table */}
        <div className="overflow-auto flex-1 p-6">
          {allKeys.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium w-1/4">Field</th>
                  <th className="pb-2 pr-4 font-medium w-[37.5%]">Before</th>
                  <th className="pb-2 font-medium w-[37.5%]">After</th>
                </tr>
              </thead>
              <tbody>
                {allKeys.map((key) => {
                  const bVal = before[key]
                  const aVal = after[key]
                  const changed = String(bVal) !== String(aVal)
                  return (
                    <tr
                      key={key}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        changed ? "bg-yellow-50 dark:bg-yellow-900/10" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400 align-top">
                        {key}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 align-top">
                        {bVal === undefined ? (
                          <span className="text-gray-300 dark:text-gray-600 italic">—</span>
                        ) : (
                          <span className={changed ? "line-through text-red-400" : ""}>
                            {fmtVal(bVal)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-gray-700 dark:text-gray-300 align-top">
                        {aVal === undefined ? (
                          <span className="text-gray-300 dark:text-gray-600 italic">—</span>
                        ) : (
                          <span className={changed ? "font-medium text-green-700 dark:text-green-400" : ""}>
                            {fmtVal(aVal)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditTrail({ initialLogs, entityId }: Props) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs)
  const [total, setTotal] = useState(initialLogs.length)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  // Filters
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [actionFilter, setActionFilter] = useState("ALL")
  const [tableFilter, setTableFilter] = useState("")
  const [recordFilter, setRecordFilter] = useState("")

  // UI state
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function buildParams(overrides: Record<string, string | number> = {}) {
    const p = new URLSearchParams()
    p.set("entityId", entityId)
    p.set("startDate", startDate)
    p.set("endDate", endDate)
    if (actionFilter !== "ALL") p.set("action", actionFilter)
    if (tableFilter) p.set("tableName", tableFilter)
    if (recordFilter) p.set("recordId", recordFilter)
    p.set("pageSize", String(PAGE_SIZE))
    for (const [k, v] of Object.entries(overrides)) p.set(k, String(v))
    return p
  }

  const fetchLogs = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      try {
        const params = buildParams({ page: targetPage })
        const res = await fetch(`/api/audit?${params}`)
        if (!res.ok) return
        const data = await res.json()
        setLogs(data.logs)
        setTotal(data.total)
        setPage(targetPage)
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityId, startDate, endDate, actionFilter, tableFilter, recordFilter],
  )

  async function handleApply() {
    await fetchLogs(1)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const params = buildParams({ page: 1, pageSize: 5000 })
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) return
      const data = await res.json()
      const rows = (data.logs as AuditLogItem[]).map((log) => ({
        timestamp: log.createdAt,
        user: log.userName,
        action: log.action,
        table: log.tableName,
        recordId: log.recordId,
        before: JSON.stringify(log.beforeJson ?? {}),
        after: JSON.stringify(log.afterJson ?? {}),
      }))
      const csv = toCsvClient(rows)
      downloadCsv(csv, `audit-trail-${today}.csv`)
    } finally {
      setExporting(false)
    }
  }

  function copyRecordId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 max-w-7xl space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-subtitle">Read-only record of all accounting actions</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Table</label>
          <input
            type="text"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder="e.g. hce_invoices"
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Record ID</label>
          <input
            type="text"
            value={recordFilter}
            onChange={(e) => setRecordFilter(e.target.value)}
            placeholder="record id"
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-36"
          />
        </div>
        <button
          onClick={handleApply}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Table</th>
              <th>Record ID</th>
              <th>Changes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  {loading ? "Loading…" : "No audit logs found for this period"}
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr
                key={log.id}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => setSelectedLog(log)}
              >
                <td className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400 font-mono">
                  {fmtTimestamp(log.createdAt)}
                </td>
                <td className="text-sm text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {log.userName}
                </td>
                <td>{actionBadge(log.action)}</td>
                <td className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {log.tableName.replace("hce_", "")}
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      copyRecordId(log.recordId)
                    }}
                    className="font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Click to copy"
                  >
                    {copiedId === log.recordId ? "Copied!" : log.recordId.slice(0, 12) + "…"}
                  </button>
                </td>
                <td className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px] truncate">
                  {diffSummary(log.beforeJson, log.afterJson)}
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedLog(log)
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          {total === 0
            ? "No results"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diff Modal */}
      {selectedLog && (
        <DiffModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}
