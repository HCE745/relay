import { describe, it, expect } from "vitest"
import { formatMoney, invoiceNo } from "../money"
import { dec } from "../billing-math"

describe("formatMoney", () => {
  it("formats numbers and Decimals as USD by default", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50")
    expect(formatMoney(dec("1234.50"))).toBe("$1,234.50")
    expect(formatMoney("0")).toBe("$0.00")
  })
  it("honors the currency", () => {
    expect(formatMoney(10, "EUR")).toBe("€10.00")
  })
})

describe("invoiceNo", () => {
  it("zero-pads to 4 digits", () => {
    expect(invoiceNo(7)).toBe("INV-0007")
    expect(invoiceNo(1234)).toBe("INV-1234")
    expect(invoiceNo(12345)).toBe("INV-12345")
  })
})
