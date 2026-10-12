import { orgDb } from "../org-db"

// Issue SLA policy (Phase 30): ack + resolve windows per severity, org-
// configurable. Deadlines are derived at report time from the issue's severity,
// which itself defaults from the category.

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export const DEFAULT_SLA: Record<Severity, { ackMinutes: number; resolveMinutes: number }> = {
  CRITICAL: { ackMinutes: 30, resolveMinutes: 4 * 60 },
  HIGH: { ackMinutes: 60, resolveMinutes: 8 * 60 },
  MEDIUM: { ackMinutes: 4 * 60, resolveMinutes: 24 * 60 },
  LOW: { ackMinutes: 24 * 60, resolveMinutes: 72 * 60 },
}

// Default severity by category (a reporter may override).
const CATEGORY_SEVERITY: Record<string, Severity> = {
  SAFETY: "CRITICAL",
  EQUIPMENT: "HIGH",
  ACCESS: "HIGH",
  CUSTOMER: "HIGH",
  QUALITY: "MEDIUM",
  SUPPLIES: "LOW",
  OTHER: "MEDIUM",
}

export function severityForCategory(category: string): Severity {
  return CATEGORY_SEVERITY[category] ?? "MEDIUM"
}

/** Effective SLA map for the org (configured rows over defaults). */
export async function getIssueSla(orgId: string): Promise<Record<Severity, { ackMinutes: number; resolveMinutes: number }>> {
  const rows = await orgDb(orgId).issueSlaRule.findMany()
  const map = { ...DEFAULT_SLA }
  for (const r of rows) map[r.severity as Severity] = { ackMinutes: r.ackMinutes, resolveMinutes: r.resolveMinutes }
  return map
}

export function deadlinesFor(severity: Severity, from: Date, sla: Record<Severity, { ackMinutes: number; resolveMinutes: number }>) {
  const s = sla[severity]
  return {
    ackDeadline: new Date(from.getTime() + s.ackMinutes * 60_000),
    resolveDeadline: new Date(from.getTime() + s.resolveMinutes * 60_000),
  }
}

export function listIssueSlaRules(orgId: string) {
  return orgDb(orgId).issueSlaRule.findMany({ orderBy: { severity: "asc" } })
}

export async function upsertIssueSlaRule(orgId: string, severity: Severity, ackMinutes: number, resolveMinutes: number) {
  const existing = await orgDb(orgId).issueSlaRule.findFirst({ where: { severity }, select: { id: true } })
  if (existing) await orgDb(orgId).issueSlaRule.updateMany({ where: { id: existing.id }, data: { ackMinutes, resolveMinutes } })
  else await orgDb(orgId).issueSlaRule.create({ data: { organizationId: orgId, severity, ackMinutes, resolveMinutes } })
  return { ok: true }
}
