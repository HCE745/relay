import { Prisma } from "../generated/prisma/client"

// Display-only formatting. All arithmetic happens in Prisma.Decimal upstream;
// here we only render an already-computed amount.
export function formatMoney(amount: Prisma.Decimal | string | number, currency = "USD"): string {
  const n = amount instanceof Prisma.Decimal ? Number(amount.toFixed(2)) : Number(amount)
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0)
}

/** Human invoice number, e.g. 7 → "INV-0007". */
export function invoiceNo(n: number): string {
  return `INV-${String(n).padStart(4, "0")}`
}
