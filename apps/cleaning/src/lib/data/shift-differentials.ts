import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import type { DifferentialRule } from "../shift-differentials"

// Shift-differential rule storage (Phase 43). Rules are entered with "HH:mm"
// window bounds; we store LOCAL minutes-from-midnight. Reads return the pure
// DifferentialRule shape the costing math consumes.

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
function toHHmm(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

type RuleInput = { name: string; startTime: string; endTime: string; daysOfWeek?: number[]; amountType: "PERCENT" | "FLAT_PER_HOUR"; value: string }

export async function listDifferentialRules(orgId: string) {
  const rules = await orgDb(orgId).shiftDifferentialRule.findMany({ orderBy: [{ isActive: "desc" }, { priority: "asc" }, { name: "asc" }] })
  return rules.map((r) => ({
    id: r.id, name: r.name, startTime: toHHmm(r.startMinute), endTime: toHHmm(r.endMinute),
    daysOfWeek: r.daysOfWeek, amountType: r.amountType, value: r.value.toString(), isActive: r.isActive,
  }))
}

/** Active rules in the shape the costing math (computeDifferential) consumes. */
export async function activeDifferentialRules(orgId: string): Promise<(DifferentialRule & { name: string })[]> {
  const rules = await orgDb(orgId).shiftDifferentialRule.findMany({ where: { isActive: true }, orderBy: { priority: "asc" } })
  return rules.map((r) => ({
    name: r.name, startMinute: r.startMinute, endMinute: r.endMinute, daysOfWeek: r.daysOfWeek,
    amountType: r.amountType, value: r.value,
  }))
}

export async function createDifferentialRule(orgId: string, input: RuleInput) {
  return orgDb(orgId).shiftDifferentialRule.create({
    data: {
      organizationId: orgId, name: input.name,
      startMinute: toMinutes(input.startTime), endMinute: toMinutes(input.endTime),
      daysOfWeek: input.daysOfWeek ?? [], amountType: input.amountType, value: new Prisma.Decimal(input.value),
    },
  })
}

export async function updateDifferentialRule(orgId: string, id: string, input: Partial<RuleInput> & { isActive?: boolean }) {
  const data: Prisma.ShiftDifferentialRuleUncheckedUpdateManyInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.startTime !== undefined) data.startMinute = toMinutes(input.startTime)
  if (input.endTime !== undefined) data.endMinute = toMinutes(input.endTime)
  if (input.daysOfWeek !== undefined) data.daysOfWeek = input.daysOfWeek
  if (input.amountType !== undefined) data.amountType = input.amountType
  if (input.value !== undefined) data.value = new Prisma.Decimal(input.value)
  if (input.isActive !== undefined) data.isActive = input.isActive
  const res = await orgDb(orgId).shiftDifferentialRule.updateMany({ where: { id }, data })
  assertFound(res.count > 0 ? {} : null, "Shift differential rule")
  return orgDb(orgId).shiftDifferentialRule.findFirst({ where: { id } })
}
