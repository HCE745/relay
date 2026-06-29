export type ScanResult = {
  vendorName: string | null
  matchedVendorId: string | null
  date: string | null
  currency: string
  subtotalCents: number | null
  taxCents: number | null
  totalCents: number | null
  lineItems: {
    description: string
    amountCents: number
    suggestedAccountId: string | null
    suggestedAccountName: string
  }[]
  overallSuggestedAccountId: string | null
  isLikelyRecurring: boolean
  recurringReason: string | null
  confidence: "high" | "medium" | "low"
}
