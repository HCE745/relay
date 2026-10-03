import { orgDb } from "../org-db"
import { Prisma } from "../../generated/prisma/client"
import { ForbiddenActionError } from "./errors"
import { computeBid, type BidInputs } from "../bid-math"

// Save a bid worksheet onto an estimate. The price is ALWAYS recomputed on the
// server from the inputs (client math is never trusted) and the full inputs +
// result are snapshotted as JSON. The estimate total is set to the bid price.
export async function saveEstimateBid(orgId: string, estimateId: string, inputs: BidInputs) {
  const est = await orgDb(orgId).estimate.findFirst({
    where: { id: estimateId },
    select: { id: true, convertedCustomerId: true, currency: true },
  })
  if (!est) return null
  if (est.convertedCustomerId) throw new ForbiddenActionError("This estimate is converted and read-only")

  const result = computeBid(inputs)
  const snapshot = { inputs, result, computedAt: new Date().toISOString() }
  const price = new Prisma.Decimal(result.price)

  const { count } = await orgDb(orgId).estimate.updateMany({
    where: { id: estimateId },
    data: {
      bidWorksheet: snapshot as unknown as Prisma.InputJsonValue,
      pricing: "PER_VISIT",
      rate: price,
      subtotal: price,
      total: price,
    },
  })
  if (count === 0) return null
  return { estimateId, result }
}
