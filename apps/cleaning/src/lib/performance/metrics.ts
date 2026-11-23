// P4 Employee performance & accountability — PURE metric logic.
//
// Performance is DERIVED on read from existing P1–P3 data (JobChecklistItem,
// ComplaintResponsibility + Issue.outcome, WorkOrder). No new store. The fair-
// attribution rules live here as pure, tested functions so the data layer and UI
// never re-derive them.

import { outcomeCountsAgainstEmployee } from "../complaints/investigation"

/** One decimal percentage (0–100). 0 when there is nothing to divide by. */
export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

export type TaskTotals = {
  assigned: number // tasks for which the employee is the designated owner
  completed: number // tasks the employee marked complete
  verified: number // their completed work that passed verification
  rejected: number // their completed work that was rejected (rework)
}

export function completionRate(t: TaskTotals): number {
  return rate(t.completed, t.assigned)
}

/** Of the employee's completed work that was reviewed, how much passed. */
export function verificationPassRate(t: TaskTotals): number {
  return rate(t.verified, t.verified + t.rejected)
}

export type ResponsibilityRecord = { outcome: string | null; isPrimary: boolean }

/**
 * FAIR ATTRIBUTION — fold a person's complaint-responsibility rows into counts:
 *   • Only SUBSTANTIATED complaints count. Unsubstantiated, inconclusive, and
 *     un-investigated allegations are EXCLUDED (never employee fault).
 *   • Substantiated findings are split into INDIVIDUAL (primary owner) vs SHARED
 *     responsibility, so a shared assignment is never treated as sole fault.
 */
export function attributeComplaints(rows: ResponsibilityRecord[]): {
  substantiated: number
  individual: number
  shared: number
} {
  let substantiated = 0
  let individual = 0
  let shared = 0
  for (const r of rows) {
    if (!outcomeCountsAgainstEmployee(r.outcome)) continue
    substantiated++
    if (r.isPrimary) individual++
    else shared++
  }
  return { substantiated, individual, shared }
}

export type CorrectiveTotals = { assigned: number; completed: number }

export type PerformanceSummary = {
  tasks: TaskTotals
  completionRate: number
  verificationPassRate: number
  rework: number // rejected tasks = rework the employee generated
  complaints: { substantiated: number; individual: number; shared: number }
  corrective: CorrectiveTotals // corrective work assigned to the employee
}

export function buildSummary(input: {
  tasks: TaskTotals
  responsibilities: ResponsibilityRecord[]
  corrective: CorrectiveTotals
}): PerformanceSummary {
  return {
    tasks: input.tasks,
    completionRate: completionRate(input.tasks),
    verificationPassRate: verificationPassRate(input.tasks),
    rework: input.tasks.rejected,
    complaints: attributeComplaints(input.responsibilities),
    corrective: input.corrective,
  }
}

// ── Trends ───────────────────────────────────────────────────────────────────

export type TrendKind = "completed" | "verified" | "rejected"
export type TrendEvent = { date: Date; kind: TrendKind }
export type TrendPoint = { period: string; completed: number; verified: number; rejected: number }

/** "YYYY-MM" bucket key in UTC (stable, timezone-agnostic for coarse trends). */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** The last `count` month keys up to (and including) `end`, oldest first. */
export function recentMonths(end: Date, count: number): string[] {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1))
    out.push(monthKey(d))
  }
  return out
}

/** Bucket timestamped events into the given ordered month keys. Events outside
 *  the window are ignored. */
export function buildTrend(events: TrendEvent[], months: string[]): TrendPoint[] {
  const idx = new Map(months.map((m, i) => [m, i]))
  const points: TrendPoint[] = months.map((m) => ({ period: m, completed: 0, verified: 0, rejected: 0 }))
  for (const e of events) {
    const i = idx.get(monthKey(e.date))
    if (i === undefined) continue
    points[i][e.kind]++
  }
  return points
}
