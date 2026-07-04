/**
 * Accounts Payable service.
 * Entered: DR Expense/COGS / CR Accounts Payable
 * Paid:    DR Accounts Payable / CR Cash
 * Vendor Credit: DR AP / CR Expense
 */
import "server-only"
import { prisma } from "./prisma"
import { createAndPostEntry } from "./ledger"
import { writeAuditLog } from "./db"
import type { Bill } from "@/generated/prisma/client"

export type BillLineInput = {
  description?: string
  productId?: string | null
  accountId: string
  quantity: number
  unitPrice: number
  classId?: string | null
  departmentId?: string | null
}

export type CreateBillParams = {
  tenantId: string
  entityId: string
  vendorId: string
  billNumber?: string | null
  date: Date
  dueDate: Date
  memo?: string
  lines: BillLineInput[]
  apAccountId: string
  createdByUserId?: string | null
}

export async function createAndEnterBill(params: CreateBillParams): Promise<Bill> {
  let subtotal = 0
  const computedLines = params.lines.map((l) => {
    const amount = Math.round(l.quantity * l.unitPrice)
    subtotal += amount
    return { ...l, amount }
  })

  const entry = await createAndPostEntry({
    tenantId: params.tenantId,
    entityId: params.entityId,
    date: params.date,
    memo: params.memo ?? `Bill ${params.billNumber ?? ""}`,
    source: "BILL",
    createdByUserId: params.createdByUserId,
    lines: [
      ...computedLines.map((l) => ({ accountId: l.accountId, debit: l.amount })),
      { accountId: params.apAccountId, credit: subtotal },
    ],
  })

  const bill = await prisma.bill.create({
    data: {
      tenantId: params.tenantId,
      entityId: params.entityId,
      vendorId: params.vendorId,
      billNumber: params.billNumber ?? null,
      date: params.date,
      dueDate: params.dueDate,
      memo: params.memo ?? null,
      subtotal,
      total: subtotal,
      amountPaid: 0,
      amountDue: subtotal,
      status: "ENTERED",
      journalEntryId: entry.id,
      lines: {
        create: computedLines.map((l) => ({
          description: l.description ?? null,
          productId: l.productId ?? null,
          accountId: l.accountId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          classId: l.classId ?? null,
          departmentId: l.departmentId ?? null,
        })),
      },
    },
  })

  await writeAuditLog({
    tenantId: params.tenantId,
    entityId: params.entityId,
    userId: params.createdByUserId,
    action: "ENTER",
    tableName: "hce_bills",
    recordId: bill.id,
    after: { status: "ENTERED", total: subtotal, vendorId: params.vendorId },
  })

  return bill
}

export type PayBillParams = {
  billId: string
  amountCents: number
  date: Date
  cashAccountId: string
  apAccountId: string
  memo?: string
  bankAccountId?: string | null
  createdByUserId?: string | null
}

export async function payBill(params: PayBillParams) {
  const bill = await prisma.bill.findUniqueOrThrow({ where: { id: params.billId } })
  if (!["ENTERED", "PARTIAL"].includes(bill.status)) {
    throw new Error("Bill is not in a payable state")
  }
  if (params.amountCents > bill.amountDue) {
    throw new Error("Payment exceeds amount due")
  }

  const entry = await createAndPostEntry({
    tenantId: bill.tenantId,
    entityId: bill.entityId,
    date: params.date,
    memo: params.memo ?? `Payment for bill ${bill.billNumber ?? bill.id}`,
    source: "PAYMENT",
    sourceId: bill.id,
    createdByUserId: params.createdByUserId,
    lines: [
      { accountId: params.apAccountId, debit: params.amountCents },
      { accountId: params.cashAccountId, credit: params.amountCents },
    ],
  })

  const newPaid = bill.amountPaid + params.amountCents
  const newDue = bill.total - newPaid
  const newStatus = newDue <= 0 ? "PAID" : "PARTIAL"

  const [payment] = await prisma.$transaction([
    prisma.billPayment.create({
      data: {
        billId: params.billId,
        date: params.date,
        amount: params.amountCents,
        bankAccountId: params.bankAccountId ?? null,
        journalEntryId: entry.id,
        memo: params.memo ?? null,
      },
    }),
    prisma.bill.update({
      where: { id: params.billId },
      data: { amountPaid: newPaid, amountDue: newDue, status: newStatus },
    }),
  ])

  await writeAuditLog({
    tenantId: bill.tenantId,
    entityId: bill.entityId,
    userId: params.createdByUserId,
    action: "PAY",
    tableName: "hce_bills",
    recordId: params.billId,
    before: { status: bill.status, amountPaid: bill.amountPaid, amountDue: bill.amountDue },
    after: { status: newStatus, amountPaid: newPaid, amountDue: newDue },
  })

  return { payment, entry }
}

export async function createVendorCredit(params: {
  tenantId: string
  entityId: string
  vendorId: string
  billId?: string | null
  amountCents: number
  date: Date
  memo?: string
  apAccountId: string
  expenseAccountId: string
  createdByUserId?: string | null
}) {
  const entry = await createAndPostEntry({
    tenantId: params.tenantId,
    entityId: params.entityId,
    date: params.date,
    memo: params.memo ?? "Vendor credit",
    source: "BILL",
    createdByUserId: params.createdByUserId,
    lines: [
      { accountId: params.apAccountId, debit: params.amountCents },
      { accountId: params.expenseAccountId, credit: params.amountCents },
    ],
  })

  const credit = await prisma.vendorCredit.create({
    data: {
      tenantId: params.tenantId,
      entityId: params.entityId,
      billId: params.billId ?? null,
      vendorId: params.vendorId,
      amount: params.amountCents,
      date: params.date,
      memo: params.memo ?? null,
      journalEntryId: entry.id,
    },
  })

  await writeAuditLog({
    tenantId: params.tenantId,
    entityId: params.entityId,
    userId: params.createdByUserId,
    action: "VENDOR_CREDIT",
    tableName: "hce_vendor_credits",
    recordId: credit.id,
    after: { amount: params.amountCents, vendorId: params.vendorId, billId: params.billId ?? null },
  })

  return credit
}
