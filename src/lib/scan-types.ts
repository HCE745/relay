export type ScanResult = {
  vendorName: string | null
  date: string | null
  currency: string
  subtotalCents: number | null
  taxCents: number | null
  totalCents: number | null
  lineItems: { description: string; amountCents: number }[]
  confidence: "high" | "medium" | "low"
}
