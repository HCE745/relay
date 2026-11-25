import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import type { Prisma } from "@/generated/prisma/client"

// ── Inventory & supply engine (Phase 51) ─────────────────────────────────────
// One chokepoint (applyStockTransaction) mutates stock, so every movement is
// recorded and idempotent. Stock is kept in the supply's STOCK unit; purchase and
// usage units convert here so staff never calculate. Supply.currentStock is the
// org-wide CLEAN total; StockLevel holds per-location clean + dirty when the
// supply is location-tracked.

const n = (d: Prisma.Decimal | number | string | null | undefined): number => (d == null ? 0 : Number(d))

export type UnitKind = "stock" | "purchase" | "usage"

/** Convert a quantity expressed in purchase/usage/stock units into STOCK units. */
export function toStockUnits(
  supply: { unitsPerPurchase?: Prisma.Decimal | number | null; stockPerUsage?: Prisma.Decimal | number | null },
  qty: number,
  unit: UnitKind,
): number {
  if (unit === "purchase") return qty * (n(supply.unitsPerPurchase) || 1)
  if (unit === "usage") return qty * (n(supply.stockPerUsage) || 1)
  return qty
}

// How a transaction type changes USABLE (clean) stock, and which location field
// carries it. `cleanDelta` is the signed change to clean stock; `dirtyDelta` to
// the dirty pool (reusables). `loc` says which location field is authoritative.
function txnEffect(type: string, qty: number): { cleanDelta: number; dirtyDelta: number; loc: "to" | "from" } {
  switch (type) {
    case "RECEIPT": return { cleanDelta: +qty, dirtyDelta: 0, loc: "to" }
    case "RETURN_CLEAN": return { cleanDelta: +qty, dirtyDelta: 0, loc: "to" }
    case "ADJUSTMENT": return { cleanDelta: +qty, dirtyDelta: 0, loc: "to" } // +to or -from set by caller
    case "CONSUMPTION": return { cleanDelta: -qty, dirtyDelta: 0, loc: "from" }
    case "LOSS": return { cleanDelta: -qty, dirtyDelta: 0, loc: "from" }
    case "DAMAGE": return { cleanDelta: -qty, dirtyDelta: 0, loc: "from" }
    case "RETURN_DIRTY": return { cleanDelta: 0, dirtyDelta: +qty, loc: "to" }
    case "LAUNDERED": return { cleanDelta: +qty, dirtyDelta: -qty, loc: "to" }
    default: return { cleanDelta: 0, dirtyDelta: 0, loc: "to" }
  }
}

export type StockTxnInput = {
  supplyId: string
  type: "RECEIPT" | "TRANSFER" | "CONSUMPTION" | "ADJUSTMENT" | "LOSS" | "DAMAGE" | "RETURN_CLEAN" | "RETURN_DIRTY" | "LAUNDERED"
  quantity: number // in `unit` (default stock units)
  unit?: UnitKind
  fromLocationId?: string | null
  toLocationId?: string | null
  actorUserId?: string | null
  jobId?: string | null
  note?: string | null
  isEstimated?: boolean
  sourceKey?: string | null // idempotency key
}

/**
 * The single stock-mutation chokepoint. Atomic, idempotent (via sourceKey), and
 * keeps StockLevel + Supply.currentStock consistent. Returns the created
 * transaction, or null when a sourceKey match means it was already applied.
 */
export async function applyStockTransaction(orgId: string, input: StockTxnInput) {
  const db = orgDb(orgId)
  const supply = await db.supply.findFirst({ where: { id: input.supplyId }, select: { id: true, unitsPerPurchase: true, stockPerUsage: true, costPerUnit: true, trackByLocation: true } })
  assertFound(supply, "Supply")
  const qty = toStockUnits(supply!, input.quantity, input.unit ?? "stock")
  if (qty <= 0 && input.type !== "ADJUSTMENT") throw new Error("Quantity must be positive")

  return db.$transaction(async (tx) => {
    // Upsert is blocked on the org-scoped client (its unique where can't carry
    // organizationId), so emulate it with findFirst + create/updateMany.
    const bumpLevel = async (locationId: string, cleanDelta: number, dirtyDelta: number) => {
      const existing = await tx.stockLevel.findFirst({ where: { supplyId: input.supplyId, inventoryLocationId: locationId }, select: { id: true } })
      if (existing) {
        await tx.stockLevel.updateMany({ where: { id: existing.id }, data: { quantity: { increment: cleanDelta }, dirtyQuantity: { increment: dirtyDelta } } })
      } else {
        await tx.stockLevel.create({ data: { organizationId: orgId, supplyId: input.supplyId, inventoryLocationId: locationId, quantity: Math.max(0, cleanDelta), dirtyQuantity: Math.max(0, dirtyDelta) } })
      }
    }

    // Idempotency: if this sourceKey already produced a txn, do nothing.
    if (input.sourceKey) {
      const existing = await tx.stockTransaction.findFirst({ where: { sourceKey: input.sourceKey }, select: { id: true } })
      if (existing) return null
    }

    const eff = txnEffect(input.type, Math.abs(qty))

    // TRANSFER: clean leaves `from`, arrives at `to`.
    if (input.type === "TRANSFER") {
      if (!input.fromLocationId || !input.toLocationId) throw new Error("Transfer needs both locations")
      await bumpLevel(input.fromLocationId, -Math.abs(qty), 0)
      await bumpLevel(input.toLocationId, +Math.abs(qty), 0)
    } else {
      const locId = eff.loc === "to" ? input.toLocationId : input.fromLocationId
      if (locId) await bumpLevel(locId, eff.cleanDelta, eff.dirtyDelta)
      // Org-level clean total mirrors the net clean change (TRANSFER is net-zero).
      if (eff.cleanDelta !== 0) {
        await tx.supply.updateMany({ where: { id: input.supplyId }, data: { currentStock: { increment: eff.cleanDelta } } })
      }
    }

    return tx.stockTransaction.create({
      data: {
        organizationId: orgId,
        supplyId: input.supplyId,
        type: input.type,
        quantity: Math.abs(qty),
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        actorUserId: input.actorUserId ?? null,
        jobId: input.jobId ?? null,
        note: input.note ?? null,
        isEstimated: input.isEstimated ?? false,
        costPerUnit: supply!.costPerUnit ?? null,
        sourceKey: input.sourceKey ?? null,
      },
    })
  })
}

// ── Locations ────────────────────────────────────────────────────────────────
export function listInventoryLocations(orgId: string) {
  return orgDb(orgId).inventoryLocation.findMany({
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { serviceLocation: { select: { name: true } }, holder: { select: { name: true } }, _count: { select: { stockLevels: true } } },
  })
}

export function getInventoryLocationByQr(orgId: string, token: string) {
  return orgDb(orgId).inventoryLocation.findFirst({ where: { qrToken: token, isActive: true }, select: { id: true, name: true, kind: true } })
}

export async function createInventoryLocation(orgId: string, input: { name: string; kind: string; serviceLocationId?: string | null; holderUserId?: string | null; isStation?: boolean }) {
  const qrToken = input.isStation || input.kind === "SUPPLY_STATION" ? `stn-${crypto.randomUUID().slice(0, 12)}` : null
  return orgDb(orgId).inventoryLocation.create({
    data: {
      organizationId: orgId, name: input.name, kind: input.kind as "WAREHOUSE",
      serviceLocationId: input.serviceLocationId ?? null, holderUserId: input.holderUserId ?? null, qrToken,
    },
  })
}

export async function updateInventoryLocation(orgId: string, id: string, data: { name?: string; isActive?: boolean }) {
  const { count } = await orgDb(orgId).inventoryLocation.updateMany({ where: { id }, data })
  return count > 0
}

/** Stock at one location (for the station log + location detail). */
export function listStockAtLocation(orgId: string, locationId: string) {
  return orgDb(orgId).stockLevel.findMany({
    where: { inventoryLocationId: locationId },
    include: { supply: { select: { id: true, name: true, unit: true, usageUnit: true, kind: true } } },
    orderBy: { supply: { name: "asc" } },
  })
}

// ── Replenishment requests ────────────────────────────────────────────────────
export function createReplenishmentRequest(orgId: string, requestedById: string, input: { supplyId?: string | null; inventoryLocationId?: string | null; quantity?: number | null; note?: string | null }) {
  return orgDb(orgId).replenishmentRequest.create({
    data: {
      organizationId: orgId, requestedById,
      supplyId: input.supplyId ?? null, inventoryLocationId: input.inventoryLocationId ?? null,
      quantity: input.quantity ?? null, note: input.note ?? null,
    },
  })
}

export function listReplenishmentRequests(orgId: string, opts: { status?: string } = {}) {
  return orgDb(orgId).replenishmentRequest.findMany({
    where: opts.status ? { status: opts.status as "OPEN" } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      supply: { select: { id: true, name: true, unit: true } },
      inventoryLocation: { select: { id: true, name: true } },
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  })
}

export async function reviewReplenishmentRequest(orgId: string, id: string, reviewerId: string, status: "APPROVED" | "FULFILLED" | "DECLINED" | "CLOSED", resolutionNote?: string) {
  const { count } = await orgDb(orgId).replenishmentRequest.updateMany({
    where: { id },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date(), resolutionNote: resolutionNote ?? null },
  })
  return count > 0
}

// ── Expected consumption (config + materialization) ──────────────────────────
export function listExpectedUsage(orgId: string, scope: { checklistTemplateId?: string; servicePlanId?: string }) {
  return orgDb(orgId).expectedSupplyUsage.findMany({
    where: { checklistTemplateId: scope.checklistTemplateId ?? undefined, servicePlanId: scope.servicePlanId ?? undefined },
    include: { supply: { select: { id: true, name: true, unit: true, usageUnit: true } } },
    orderBy: { supply: { name: "asc" } },
  })
}

export async function setExpectedUsage(orgId: string, input: { supplyId: string; quantity: number; checklistTemplateId?: string | null; servicePlanId?: string | null }) {
  const existing = await orgDb(orgId).expectedSupplyUsage.findFirst({
    where: { supplyId: input.supplyId, checklistTemplateId: input.checklistTemplateId ?? null, servicePlanId: input.servicePlanId ?? null },
    select: { id: true },
  })
  if (existing) {
    await orgDb(orgId).expectedSupplyUsage.updateMany({ where: { id: existing.id }, data: { quantity: input.quantity } })
    return orgDb(orgId).expectedSupplyUsage.findFirst({ where: { id: existing.id } })
  }
  return orgDb(orgId).expectedSupplyUsage.create({
    data: { organizationId: orgId, supplyId: input.supplyId, quantity: input.quantity, checklistTemplateId: input.checklistTemplateId ?? null, servicePlanId: input.servicePlanId ?? null },
  })
}

export async function removeExpectedUsage(orgId: string, id: string) {
  const { count } = await orgDb(orgId).expectedSupplyUsage.deleteMany({ where: { id } })
  return count > 0
}

/**
 * On a job's completion, record ESTIMATED consumption from the configured
 * expected-usage (plan overrides template). Idempotent per job+supply via
 * sourceKey, so re-completion or a duplicate event never double-deducts. Only
 * runs when the org opts in (invAutoEstimate). Deducts from the site's inventory
 * location when the supply is location-tracked, else org-level stock.
 */
export async function materializeEstimatedConsumption(orgId: string, jobId: string) {
  const db = orgDb(orgId)
  const org = await db.organization.findFirst({ where: { id: orgId }, select: { invAutoEstimate: true } })
  if (!org?.invAutoEstimate) return { recorded: 0 }

  const job = await db.job.findFirst({
    where: { id: jobId },
    select: { id: true, servicePlanId: true, serviceLocationId: true, servicePlan: { select: { checklistTemplateId: true } } },
  })
  if (!job) return { recorded: 0 }

  // Plan-level config wins; otherwise the plan's checklist template config.
  const planUsages = job.servicePlanId ? await listExpectedUsage(orgId, { servicePlanId: job.servicePlanId }) : []
  const tplId = job.servicePlan?.checklistTemplateId ?? undefined
  const tplUsages = tplId ? await listExpectedUsage(orgId, { checklistTemplateId: tplId }) : []
  const bySupply = new Map<string, { supplyId: string; quantity: number }>()
  for (const u of tplUsages) bySupply.set(u.supplyId, { supplyId: u.supplyId, quantity: n(u.quantity) })
  for (const u of planUsages) bySupply.set(u.supplyId, { supplyId: u.supplyId, quantity: n(u.quantity) }) // override

  // Resolve the site's inventory location once (if any).
  const siteLoc = job.serviceLocationId
    ? await db.inventoryLocation.findFirst({ where: { serviceLocationId: job.serviceLocationId, isActive: true }, select: { id: true } })
    : null

  let recorded = 0
  for (const u of bySupply.values()) {
    const supply = await db.supply.findFirst({ where: { id: u.supplyId }, select: { trackByLocation: true } })
    const res = await applyStockTransaction(orgId, {
      supplyId: u.supplyId,
      type: "CONSUMPTION",
      quantity: u.quantity,
      unit: "usage",
      fromLocationId: supply?.trackByLocation ? siteLoc?.id ?? null : null,
      jobId,
      isEstimated: true,
      sourceKey: `job:${jobId}:est:${u.supplyId}`,
      note: "Estimated consumption (job completed)",
    })
    if (res) recorded++
  }
  return { recorded }
}

// ── Digital supply-station log ───────────────────────────────────────────────
// A few taps at a station: supplies taken, bottles refilled, clean/dirty/damaged
// returns — recorded in ONE submission with the employee, station, and time
// filled in automatically. Each line becomes an auditable stock transaction.
const STATION_ACTION: Record<string, { type: StockTxnInput["type"]; dir: "from" | "to"; defaultUnit: UnitKind }> = {
  TAKEN: { type: "CONSUMPTION", dir: "from", defaultUnit: "stock" },
  REFILLED: { type: "CONSUMPTION", dir: "from", defaultUnit: "usage" },
  RETURN_CLEAN: { type: "RETURN_CLEAN", dir: "to", defaultUnit: "stock" },
  RETURN_DIRTY: { type: "RETURN_DIRTY", dir: "to", defaultUnit: "stock" },
  DAMAGED: { type: "DAMAGE", dir: "from", defaultUnit: "stock" },
}

export async function submitStationLog(
  orgId: string,
  stationId: string,
  actorUserId: string,
  lines: { supplyId: string; action: keyof typeof STATION_ACTION; quantity: number; unit?: UnitKind }[],
) {
  const station = await orgDb(orgId).inventoryLocation.findFirst({ where: { id: stationId, isActive: true }, select: { id: true } })
  assertFound(station, "Supply station")
  let recorded = 0
  for (const line of lines) {
    const map = STATION_ACTION[line.action]
    if (!map) continue
    await applyStockTransaction(orgId, {
      supplyId: line.supplyId,
      type: map.type,
      quantity: line.quantity,
      unit: line.unit ?? map.defaultUnit,
      fromLocationId: map.dir === "from" ? stationId : null,
      toLocationId: map.dir === "to" ? stationId : null,
      actorUserId,
      note: `Station log: ${line.action.toLowerCase().replace("_", " ")}`,
    })
    recorded++
  }
  return { recorded }
}

/** Estimated-vs-actual usage variance for a window (management reporting). */
export async function usageVariance(orgId: string, start: Date, end: Date) {
  const rows = await orgDb(orgId).stockTransaction.groupBy({
    by: ["supplyId", "isEstimated"],
    where: { type: "CONSUMPTION", createdAt: { gte: start, lte: end } },
    _sum: { quantity: true },
  })
  const map = new Map<string, { estimated: number; actual: number }>()
  for (const r of rows) {
    const e = map.get(r.supplyId) ?? { estimated: 0, actual: 0 }
    if (r.isEstimated) e.estimated += n(r._sum.quantity)
    else e.actual += n(r._sum.quantity)
    map.set(r.supplyId, e)
  }
  return map
}
