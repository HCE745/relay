import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError, ReferenceError } from "./errors"

// Key & asset custody tracking (Phase 36). Builds on Phase 14 (AccessItem issue/
// return): adds a permanent chain-of-custody event log, a job link on checkout,
// transfers, a lost/replaced chain, and the reports (outstanding, per item, per
// person). Every movement writes both a CustodyEvent (history) and an
// AuditEvent (permanent security record). Recording is OWNER/ADMIN/MANAGER/
// SUPERVISOR only (enforced at the route via requireOperations); cleaners cannot.

type Tx = Parameters<Parameters<ReturnType<typeof orgDb>["$transaction"]>[0]>[0]

// One helper writes the matching CustodyEvent + AuditEvent inside a transaction,
// so history and the security record never diverge.
async function writeEvent(
  tx: Tx,
  orgId: string,
  target: { accessItemId?: string; assetId?: string },
  action: "CHECKED_OUT" | "CHECKED_IN" | "TRANSFERRED" | "REPORTED_LOST" | "REPLACED" | "NOT_RETURNED",
  recordedById: string,
  fields: { holderUserId?: string | null; fromUserId?: string | null; jobId?: string | null; serviceLocationId?: string | null; notes?: string | null } = {},
) {
  await tx.custodyEvent.create({
    data: {
      organizationId: orgId,
      accessItemId: target.accessItemId ?? null,
      assetId: target.assetId ?? null,
      action,
      holderUserId: fields.holderUserId ?? null,
      fromUserId: fields.fromUserId ?? null,
      jobId: fields.jobId ?? null,
      serviceLocationId: fields.serviceLocationId ?? null,
      notes: fields.notes ?? null,
      recordedById,
    },
  })
  await tx.auditEvent.create({
    data: {
      organizationId: orgId,
      actorUserId: recordedById,
      entityType: target.accessItemId ? "AccessItem" : "Asset",
      entityId: target.accessItemId ?? target.assetId!,
      action: `custody_${action.toLowerCase()}`,
      oldValue: fields.fromUserId ?? undefined,
      newValue: fields.holderUserId ?? undefined,
      metadata: { jobId: fields.jobId ?? undefined, notes: fields.notes ?? undefined },
    },
  })
}

async function activeUser(orgId: string, userId: string) {
  const u = await orgDb(orgId).user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } })
  if (!u) throw new ReferenceError("That employee is not available to hold custody")
}
async function validJob(orgId: string, jobId: string) {
  const j = await orgDb(orgId).job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(j, "Job")
}

// ── Access item custody ───────────────────────────────────────────────────────

export type CheckoutInput = { toUserId: string; jobId?: string | null; notes?: string | null }

/** Check a key/fob/badge out to a person. A jobId links it to specific scheduled
 *  work; omit it for a standing hold (e.g. a nightly-route master key). */
export async function checkoutAccessItem(orgId: string, itemId: string, input: CheckoutInput, recordedById: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id: itemId }, select: { id: true, status: true, holderUserId: true, serviceLocationId: true } })
  assertFound(item, "Access item")
  if (item!.status === "LOST") throw new ForbiddenActionError("This item is marked lost. Replace it to issue a new one.")
  if (item!.holderUserId) throw new ForbiddenActionError("This item is already checked out. Check it in or transfer it.")
  await activeUser(orgId, input.toUserId)
  if (input.jobId) await validJob(orgId, input.jobId)
  await db.$transaction(async (tx) => {
    await tx.accessItem.updateMany({ where: { id: itemId }, data: { holderUserId: input.toUserId, status: "ISSUED", heldSince: new Date() } })
    await writeEvent(tx, orgId, { accessItemId: itemId }, "CHECKED_OUT", recordedById, { holderUserId: input.toUserId, jobId: input.jobId ?? null, serviceLocationId: item!.serviceLocationId, notes: input.notes })
  })
  return { id: itemId }
}

export async function checkinAccessItem(orgId: string, itemId: string, notes: string | null, recordedById: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id: itemId }, select: { id: true, holderUserId: true, serviceLocationId: true } })
  assertFound(item, "Access item")
  if (!item!.holderUserId) throw new ForbiddenActionError("This item is not checked out.")
  await db.$transaction(async (tx) => {
    await tx.accessItem.updateMany({ where: { id: itemId }, data: { holderUserId: null, status: "RETURNED", heldSince: null } })
    await writeEvent(tx, orgId, { accessItemId: itemId }, "CHECKED_IN", recordedById, { fromUserId: item!.holderUserId, serviceLocationId: item!.serviceLocationId, notes })
  })
  return { id: itemId }
}

/** Hand an item directly from the current holder to another person, logging both. */
export async function transferAccessItem(orgId: string, itemId: string, toUserId: string, notes: string | null, recordedById: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id: itemId }, select: { id: true, holderUserId: true, serviceLocationId: true } })
  assertFound(item, "Access item")
  if (!item!.holderUserId) throw new ForbiddenActionError("This item is not checked out, so there is nothing to transfer.")
  if (item!.holderUserId === toUserId) throw new ForbiddenActionError("The item is already held by that person.")
  await activeUser(orgId, toUserId)
  await db.$transaction(async (tx) => {
    await tx.accessItem.updateMany({ where: { id: itemId }, data: { holderUserId: toUserId, status: "ISSUED", heldSince: new Date() } })
    await writeEvent(tx, orgId, { accessItemId: itemId }, "TRANSFERRED", recordedById, { fromUserId: item!.holderUserId, holderUserId: toUserId, serviceLocationId: item!.serviceLocationId, notes })
  })
  return { id: itemId }
}

export async function reportAccessItemLost(orgId: string, itemId: string, notes: string | null, recordedById: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id: itemId }, select: { id: true, holderUserId: true, serviceLocationId: true } })
  assertFound(item, "Access item")
  await db.$transaction(async (tx) => {
    await tx.accessItem.updateMany({ where: { id: itemId }, data: { status: "LOST", holderUserId: null, heldSince: null } })
    await writeEvent(tx, orgId, { accessItemId: itemId }, "REPORTED_LOST", recordedById, { fromUserId: item!.holderUserId, serviceLocationId: item!.serviceLocationId, notes })
  })
  return { id: itemId }
}

/** Cut a replacement for a lost item. The new item links back to the one it
 *  replaces so the chain of custody stays intact. */
export async function replaceAccessItem(orgId: string, lostItemId: string, input: { identifier: string; notes?: string | null }, recordedById: string) {
  const db = orgDb(orgId)
  const lost = await db.accessItem.findFirst({ where: { id: lostItemId }, select: { id: true, type: true, serviceLocationId: true, description: true, replacedBy: { select: { id: true } } } })
  assertFound(lost, "Access item")
  if (lost!.replacedBy) throw new ForbiddenActionError("This item has already been replaced.")
  const newId = await db.$transaction(async (tx) => {
    // The item being replaced is, by definition, gone — mark it lost and clear any holder.
    await tx.accessItem.updateMany({ where: { id: lostItemId }, data: { status: "LOST", holderUserId: null, heldSince: null } })
    const created = await tx.accessItem.create({
      data: {
        organizationId: orgId, serviceLocationId: lost!.serviceLocationId, type: lost!.type,
        identifier: input.identifier, description: lost!.description, replacesId: lostItemId, status: "AVAILABLE",
      },
      select: { id: true },
    })
    await writeEvent(tx, orgId, { accessItemId: created.id }, "REPLACED", recordedById, { notes: input.notes ?? `Replaces item ${lostItemId}` })
    return created.id
  })
  return { id: newId }
}

// ── Asset custody ─────────────────────────────────────────────────────────────

export async function checkoutAsset(orgId: string, assetId: string, input: CheckoutInput, recordedById: string) {
  const db = orgDb(orgId)
  const asset = await db.asset.findFirst({ where: { id: assetId }, select: { id: true, custodyUserId: true } })
  assertFound(asset, "Asset")
  if (asset!.custodyUserId) throw new ForbiddenActionError("This asset is already checked out. Check it in or transfer it.")
  await activeUser(orgId, input.toUserId)
  if (input.jobId) await validJob(orgId, input.jobId)
  await db.$transaction(async (tx) => {
    await tx.asset.updateMany({ where: { id: assetId }, data: { custodyUserId: input.toUserId, custodySince: new Date() } })
    await writeEvent(tx, orgId, { assetId }, "CHECKED_OUT", recordedById, { holderUserId: input.toUserId, jobId: input.jobId ?? null, notes: input.notes })
  })
  return { id: assetId }
}

export async function checkinAsset(orgId: string, assetId: string, notes: string | null, recordedById: string) {
  const db = orgDb(orgId)
  const asset = await db.asset.findFirst({ where: { id: assetId }, select: { id: true, custodyUserId: true } })
  assertFound(asset, "Asset")
  if (!asset!.custodyUserId) throw new ForbiddenActionError("This asset is not checked out.")
  await db.$transaction(async (tx) => {
    await tx.asset.updateMany({ where: { id: assetId }, data: { custodyUserId: null, custodySince: null } })
    await writeEvent(tx, orgId, { assetId }, "CHECKED_IN", recordedById, { fromUserId: asset!.custodyUserId, notes })
  })
  return { id: assetId }
}

export async function transferAsset(orgId: string, assetId: string, toUserId: string, notes: string | null, recordedById: string) {
  const db = orgDb(orgId)
  const asset = await db.asset.findFirst({ where: { id: assetId }, select: { id: true, custodyUserId: true } })
  assertFound(asset, "Asset")
  if (!asset!.custodyUserId) throw new ForbiddenActionError("This asset is not checked out, so there is nothing to transfer.")
  if (asset!.custodyUserId === toUserId) throw new ForbiddenActionError("The asset is already held by that person.")
  await activeUser(orgId, toUserId)
  await db.$transaction(async (tx) => {
    await tx.asset.updateMany({ where: { id: assetId }, data: { custodyUserId: toUserId, custodySince: new Date() } })
    await writeEvent(tx, orgId, { assetId }, "TRANSFERRED", recordedById, { fromUserId: asset!.custodyUserId, holderUserId: toUserId, notes })
  })
  return { id: assetId }
}

export async function reportAssetLost(orgId: string, assetId: string, notes: string | null, recordedById: string) {
  const db = orgDb(orgId)
  const asset = await db.asset.findFirst({ where: { id: assetId }, select: { id: true, custodyUserId: true } })
  assertFound(asset, "Asset")
  await db.$transaction(async (tx) => {
    await tx.asset.updateMany({ where: { id: assetId }, data: { custodyUserId: null, custodySince: null } })
    await writeEvent(tx, orgId, { assetId }, "REPORTED_LOST", recordedById, { fromUserId: asset!.custodyUserId, notes })
  })
  return { id: assetId }
}

// ── Reports / reads ───────────────────────────────────────────────────────────

export type OutstandingRow = { kind: "ACCESS" | "ASSET"; id: string; label: string; detail: string; holderId: string; holderName: string; since: Date | null; siteName: string | null; notReturned: boolean }

/** Everything checked out and not returned, longest-out first. Items a departed
 *  employee never returned stay here, flagged unrecovered (notReturned). */
export async function listOutstandingCustody(orgId: string): Promise<OutstandingRow[]> {
  const db = orgDb(orgId)
  const [items, assets] = await Promise.all([
    db.accessItem.findMany({
      where: { status: "ISSUED", holderUserId: { not: null } },
      select: { id: true, type: true, identifier: true, heldSince: true, custodyNotReturned: true, holder: { select: { id: true, name: true } }, serviceLocation: { select: { name: true } } },
    }),
    db.asset.findMany({
      where: { custodyUserId: { not: null } },
      select: { id: true, name: true, category: true, custodySince: true, custodyNotReturned: true, custodyHolder: { select: { id: true, name: true } } },
    }),
  ])
  const rows: OutstandingRow[] = [
    ...items.map((i): OutstandingRow => ({ kind: "ACCESS", id: i.id, label: i.identifier, detail: i.type, holderId: i.holder?.id ?? "", holderName: i.holder?.name ?? "", since: i.heldSince, siteName: i.serviceLocation?.name ?? null, notReturned: i.custodyNotReturned })),
    ...assets.map((a): OutstandingRow => ({ kind: "ASSET", id: a.id, label: a.name, detail: a.category, holderId: a.custodyHolder?.id ?? "", holderName: a.custodyHolder?.name ?? "", since: a.custodySince, siteName: null, notReturned: a.custodyNotReturned })),
  ]
  // Longest out first (oldest "since"); items with no timestamp sort last.
  rows.sort((x, y) => (x.since?.getTime() ?? Infinity) - (y.since?.getTime() ?? Infinity))
  return rows
}

/**
 * Offboarding override: a departed employee never returned their keys/assets.
 * Marks each still-held item NOT_RETURNED (keeping the holder so it stays on the
 * outstanding report, flagged unrecovered), logs a CustodyEvent + AuditEvent per
 * item, and records the override + reason against the user. OWNER/ADMIN only
 * (enforced by the caller). Returns how many items were flagged.
 */
export async function markUnrecoveredForUser(orgId: string, userId: string, reason: string, actorId: string): Promise<number> {
  const db = orgDb(orgId)
  const [items, assets] = await Promise.all([
    db.accessItem.findMany({ where: { holderUserId: userId, status: "ISSUED" }, select: { id: true, serviceLocationId: true } }),
    db.asset.findMany({ where: { custodyUserId: userId }, select: { id: true } }),
  ])
  const total = items.length + assets.length
  if (total === 0) return 0
  await db.$transaction(async (tx) => {
    for (const i of items) {
      await tx.accessItem.updateMany({ where: { id: i.id }, data: { custodyNotReturned: true } })
      await writeEvent(tx, orgId, { accessItemId: i.id }, "NOT_RETURNED", actorId, { fromUserId: userId, serviceLocationId: i.serviceLocationId, notes: reason })
    }
    for (const a of assets) {
      await tx.asset.updateMany({ where: { id: a.id }, data: { custodyNotReturned: true } })
      await writeEvent(tx, orgId, { assetId: a.id }, "NOT_RETURNED", actorId, { fromUserId: userId, notes: reason })
    }
    await tx.auditEvent.create({ data: { organizationId: orgId, actorUserId: actorId, entityType: "User", entityId: userId, action: "custody_offboarding_override", newValue: String(total), metadata: { reason } } })
  })
  return total
}

const historyInclude = {
  holder: { select: { name: true } },
  fromUser: { select: { name: true } },
  recordedBy: { select: { name: true } },
  job: { select: { id: true, title: true } },
  serviceLocation: { select: { name: true } },
} as const

export function listAccessItemCustody(orgId: string, accessItemId: string) {
  return orgDb(orgId).custodyEvent.findMany({ where: { accessItemId }, orderBy: { createdAt: "desc" }, include: historyInclude })
}
export function listAssetCustody(orgId: string, assetId: string) {
  return orgDb(orgId).custodyEvent.findMany({ where: { assetId }, orderBy: { createdAt: "desc" }, include: historyInclude })
}

/** What a person currently holds (keys + assets), for the employee page and the
 *  offboarding check. */
export async function listUserHeldItems(orgId: string, userId: string) {
  const db = orgDb(orgId)
  const [items, assets] = await Promise.all([
    db.accessItem.findMany({ where: { holderUserId: userId, status: "ISSUED" }, select: { id: true, type: true, identifier: true, heldSince: true, serviceLocation: { select: { name: true } } } }),
    db.asset.findMany({ where: { custodyUserId: userId }, select: { id: true, name: true, category: true, custodySince: true } }),
  ])
  return {
    accessItems: items.map((i) => ({ id: i.id, label: i.identifier, type: i.type, since: i.heldSince, siteName: i.serviceLocation?.name ?? null })),
    assets: assets.map((a) => ({ id: a.id, label: a.name, category: a.category, since: a.custodySince })),
    total: items.length + assets.length,
  }
}

export async function countUserHeldItems(orgId: string, userId: string): Promise<number> {
  const db = orgDb(orgId)
  const [k, a] = await Promise.all([
    db.accessItem.count({ where: { holderUserId: userId, status: "ISSUED" } }),
    db.asset.count({ where: { custodyUserId: userId } }),
  ])
  return k + a
}

/** Upcoming/active jobs, for the optional job link when checking an item out. */
export function listCheckoutJobs(orgId: string) {
  return orgDb(orgId).job.findMany({
    where: { status: { in: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] } },
    orderBy: { scheduledStart: "asc" },
    take: 100,
    select: { id: true, title: true, scheduledStart: true, serviceLocation: { select: { name: true } } },
  })
}

/** Items checked out for a specific job (the job detail page). */
export function listJobCustody(orgId: string, jobId: string) {
  return orgDb(orgId).custodyEvent.findMany({
    where: { jobId, action: "CHECKED_OUT" },
    orderBy: { createdAt: "desc" },
    include: { holder: { select: { name: true } }, accessItem: { select: { id: true, identifier: true, type: true, status: true } }, asset: { select: { id: true, name: true } } },
  })
}
