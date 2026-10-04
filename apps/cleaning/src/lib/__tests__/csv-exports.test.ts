import { describe, it, expect } from "vitest"
import { qboInvoicesCsv, xeroInvoicesCsv, qboCustomersCsv, xeroContactsCsv, gustoHoursCsv, adpHoursCsv } from "../csv-exports"

const inv = [{
  invoiceNo: "INV-0001", customer: "Acme, Inc", invoiceDate: "2026-06-10", dueDate: "2026-07-10",
  lines: [{ description: "Nightly clean", quantity: 1, rate: "300.00", amount: "300.00" }, { description: "Extra", quantity: 2, rate: "50.00", amount: "100.00" }],
}]

describe("invoice CSV", () => {
  it("QBO: header + one row per line, comma in name is quoted", () => {
    const rows = qboInvoicesCsv(inv).split("\r\n")
    expect(rows[0]).toBe("InvoiceNo,Customer,InvoiceDate,DueDate,ItemDescription,ItemQuantity,ItemRate,ItemAmount")
    expect(rows).toHaveLength(3) // header + 2 lines
    expect(rows[1]).toContain('"Acme, Inc"') // quoted because of the comma
    expect(rows[1]).toContain("INV-0001")
  })
  it("Xero: precoded headers with required asterisks", () => {
    const header = xeroInvoicesCsv(inv).split("\r\n")[0]
    expect(header).toBe("*ContactName,*InvoiceNumber,*InvoiceDate,*DueDate,Description,*Quantity,*UnitAmount,*AccountCode,*TaxType")
  })
})

describe("customer CSV", () => {
  const cust = [{ name: "Globex", email: "ap@globex.co", phone: "555-1212", address: "1 Main St" }]
  it("QBO customers header", () => {
    expect(qboCustomersCsv(cust).split("\r\n")[0]).toBe("Customer,Email,Phone,Billing Address")
  })
  it("Xero contacts header", () => {
    expect(xeroContactsCsv(cust).split("\r\n")[0]).toBe("*ContactName,EmailAddress,POAddressLine1,PhoneNumber")
  })
})

describe("payroll hours CSV", () => {
  const rows = [{ employeeId: "u1", firstName: "Al", lastName: "Baker", email: "al@t.co", regularHours: "40", overtimeHours: "0" }]
  it("Gusto header + row", () => {
    const out = gustoHoursCsv(rows).split("\r\n")
    expect(out[0]).toBe("First Name,Last Name,Employee Email,Regular Hours,Overtime Hours")
    expect(out[1]).toBe("Al,Baker,al@t.co,40,0")
  })
  it("ADP header + combined name", () => {
    const out = adpHoursCsv(rows).split("\r\n")
    expect(out[0]).toBe("Employee ID,Employee Name,Regular Hours,Overtime Hours")
    expect(out[1]).toBe("u1,Al Baker,40,0")
  })
})
