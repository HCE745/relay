import { orgDb } from "../org-db"
import { assertFound, ReferenceError } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import { contractProgress } from "../contract-terms"
import type { z } from "zod"
import type { contractCreateSchema, contractUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof contractCreateSchema>
type UpdateInput = z.infer<typeof contractUpdateSchema>
type Money = Prisma.Decimal
const ZERO = new Prisma.Decimal(0)

const dec = (v?: string) => (v != null ? new Prisma.Decimal(v) : null)
const toDate = (d?: string) => (d ? new Date(`${d}T00:00:00.000Z`) : null)
const within = (d: Date, start: Date, end: Date | null) => d >= start && (end == null || d <= end)

// Actual invoiced revenue attributed to a contract = Σ non-VOID invoice-line
// amounts whose job's service plan is linked to the contract, within the
// contract's date window. This never GENERATES invoices — it only reads them.
async function invoicedByContract(orgId: string, contracts: { id: string; startDate: Date; endDate: Date | null }[]): Promise<Map<string, Money>> {
  const map = new Map<string, Money>()
  if (contracts.length === 0) return map
  const byId = new Map(contracts.map((c) => [c.id, c]))
  const ids = contracts.map((c) => c.id)
  const invoices = await orgDb(orgId).invoice.findMany({
    where: { status: { not: "VOID" } },
    select: {
      lines: {
        where: { job: { servicePlan: { contractId: { in: ids } } } },
        select: { amount: true, serviceDate: true, job: { select: { servicePlan: { select: { contractId: true } } } } },
      },
    },
  })
  for (const inv of invoices) {
    for (const l of inv.lines) {
      const cid = l.job?.servicePlan?.contractId
      if (!cid) continue
      const c = byId.get(cid)
      if (!c || !within(l.serviceDate, c.startDate, c.endDate)) continue
      map.set(cid, (map.get(cid) ?? ZERO).plus(l.amount))
    }
  }
  return map
}

export async function listContracts(orgId: string) {
  const contracts = await orgDb(orgId).contract.findMany({
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: { customer: { select: { id: true, name: true } }, _count: { select: { servicePlans: true } } },
  })
  const invoiced = await invoicedByContract(orgId, contracts)
  return contracts.map((c) => ({ ...c, invoiced: invoiced.get(c.id) ?? ZERO }))
}

export async function getContract(orgId: string, id: string) {
  const contract = await orgDb(orgId).contract.findFirst({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      servicePlans: { include: { serviceLocation: { select: { name: true } } }, orderBy: { name: "asc" } },
    },
  })
  if (!contract) return null
  const invoiced = (await invoicedByContract(orgId, [contract])).get(contract.id) ?? ZERO
  return { contract, progress: contractProgress(contract.contractValue, invoiced) }
}

/** Service plans belonging to the contract's customer — candidates for linking. */
export async function listLinkablePlans(orgId: string, customerId: string) {
  return orgDb(orgId).servicePlan.findMany({
    where: { serviceLocation: { customerId } },
    select: { id: true, name: true, contractId: true, serviceLocation: { select: { name: true } } },
    orderBy: { name: "asc" },
  })
}

export async function createContract(orgId: string, input: CreateInput) {
  assertFound(await orgDb(orgId).customer.findFirst({ where: { id: input.customerId }, select: { id: true } }), "Customer")
  return orgDb(orgId).contract.create({
    data: {
      organizationId: orgId,
      customerId: input.customerId,
      title: input.title,
      startDate: toDate(input.startDate)!,
      endDate: toDate(input.endDate),
      autoRenew: input.autoRenew ?? false,
      contractValue: dec(input.contractValue),
      billingFrequency: input.billingFrequency ?? "MONTHLY",
      status: input.status ?? "DRAFT",
      documentUrl: input.documentUrl,
      notes: input.notes,
    },
  })
}

export async function updateContract(orgId: string, id: string, input: UpdateInput) {
  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = input.title
  if (input.startDate !== undefined) data.startDate = toDate(input.startDate)
  if (input.endDate !== undefined) data.endDate = toDate(input.endDate)
  if (input.autoRenew !== undefined) data.autoRenew = input.autoRenew
  if (input.contractValue !== undefined) data.contractValue = dec(input.contractValue)
  if (input.billingFrequency !== undefined) data.billingFrequency = input.billingFrequency
  if (input.status !== undefined) data.status = input.status
  if (input.documentUrl !== undefined) data.documentUrl = input.documentUrl
  if (input.notes !== undefined) data.notes = input.notes
  const { count } = await orgDb(orgId).contract.updateMany({ where: { id }, data })
  if (count === 0) return null
  const r = await getContract(orgId, id)
  return r?.contract ?? null
}

/**
 * Set the contract's linked service plans (optional linking). Replaces the set:
 * plans not in `planIds` are unlinked, plans in it are linked. Plans must belong
 * to the contract's customer. This is purely an association — it never changes
 * how invoicing works.
 */
export async function setContractPlans(orgId: string, contractId: string, planIds: string[]) {
  const db = orgDb(orgId)
  const contract = await db.contract.findFirst({ where: { id: contractId }, select: { id: true, customerId: true } })
  if (!contract) return null
  if (planIds.length > 0) {
    const valid = await db.servicePlan.findMany({
      where: { id: { in: planIds }, serviceLocation: { customerId: contract.customerId } },
      select: { id: true },
    })
    if (valid.length !== planIds.length) throw new ReferenceError("A selected plan does not belong to this customer")
  }
  await db.$transaction([
    db.servicePlan.updateMany({ where: { contractId, id: { notIn: planIds } }, data: { contractId: null } }),
    ...(planIds.length > 0 ? [db.servicePlan.updateMany({ where: { id: { in: planIds } }, data: { contractId } })] : []),
  ])
  const r = await getContract(orgId, contractId)
  return r?.contract ?? null
}

/** Count ACTIVE contracts expiring within `leadDays` — the dashboard warning. */
export async function countExpiring(orgId: string, leadDays: number, now: Date = new Date()): Promise<number> {
  const end = new Date(now.getTime() + leadDays * 86_400_000)
  return orgDb(orgId).contract.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: end } } })
}
