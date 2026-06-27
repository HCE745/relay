/**
 * Accounts Receivable service.
 * SENT:    DR Accounts Receivable / CR Revenue (+ DR AR / CR Sales Tax Payable if taxed)
 * Payment: DR Cash / CR Accounts Receivable
 * Credit Memo: DR Revenue / CR Accounts Receivable
 */
import "server-only"
import { prisma } from "./prisma"
import { createAndPostEntry } from "./ledger"
import type { Invoice, InvoiceLine } from "@/generated/prisma/client"

export type InvoiceLineInput = {
  description?: string
  productId?: string | null
  accountId: string
  quantity: number
  unitPrice: number
  taxRate?: number | null
  classId?: string | null
  departmentId?: string | null
}

export type CreateInvoiceParams = {
  tenantId: string
  entityId: string
  customerId: string
  invoiceNumber: string
  date: Date
  dueDate: Date
  memo?: string
  taxRate?: number | null
  lines: InvoiceLineInput[]
  createdByUserId?: string | null
}

function calcInvoiceTotals(lines: InvoiceLineInput[], headerTaxRate?: number | null) {
  let subtotal = 0
  let taxAmount = 0
  const computed = lines.map((l) => {
    const amount = Math.round(l.quantity * l.unitPrice)
    const rate = l.taxRate ?? headerTaxRate ?? 0
    const lineTax = Math.round(amount * rate)
    subtotal += amount
    taxAmount += lineTax
    return { ...l, amount, taxAmount: lineTax }
  })
  return { subtotal, taxAmount, total: subtotal + taxAmount, lines: computed }
}

export async function createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
  const { subtotal, taxAmount, total, lines } = calcInvoiceTotals(params.lines, params.taxRate)

  return prisma.invoice.create({
    data: {
      tenantId: params.tenantId,
      entityId: params.entityId,
      customerId: params.customerId,
      invoiceNumber: params.invoiceNumber,
      date: params.date,
      dueDate: params.dueDate,
      memo: params.memo ?? null,
      taxRate: params.taxRate ?? null,
      subtotal,
      taxAmount,
      total,
      amountPaid: 0,
      amountDue: total,
      status: "DRAFT",
      lines: {
        create: lines.map((l) => ({
          description: l.description ?? null,
          productId: l.productId ?? null,
          accountId: l.accountId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          taxRate: l.taxRate ?? null,
          taxAmount: l.taxAmount,
          classId: l.classId ?? null,
          departmentId: l.departmentId ?? null,
        })),
      },
    },
  })
}

export type SendInvoiceParams = {
  invoiceId: string
  arAccountId: string
  salesTaxPayableAccountId?: string | null
  createdByUserId?: string | null
}

/** Send invoice: posts ledger entry DR AR / CR Revenue (+tax). */
export async function sendInvoice(params: SendInvoiceParams): Promise<Invoice> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: params.invoiceId },
    include: { lines: true },
  })
  if (invoice.status !== "DRAFT") throw new Error("Only DRAFT invoices can be sent")

  const ledgerLines: Parameters<typeof createAndPostEntry>[0]["lines"] = []

  // DR Accounts Receivable for full total
  ledgerLines.push({ accountId: params.arAccountId, debit: invoice.total })

  // CR Revenue per line
  for (const line of invoice.lines) {
    if (!line.accountId) continue
    ledgerLines.push({ accountId: line.accountId, credit: line.amount })
  }

  // CR Sales Tax Payable for tax
  if (invoice.taxAmount > 0 && params.salesTaxPayableAccountId) {
    ledgerLines.push({ accountId: params.salesTaxPayableAccountId, credit: invoice.taxAmount })
  }

  const entry = await createAndPostEntry({
    tenantId: invoice.tenantId,
    entityId: invoice.entityId,
    date: invoice.date,
    memo: `Invoice ${invoice.invoiceNumber}`,
    source: "INVOICE",
    sourceId: invoice.id,
    createdByUserId: params.createdByUserId,
    lines: ledgerLines,
  })

  return prisma.invoice.update({
    where: { id: params.invoiceId },
    data: { status: "SENT", journalEntryId: entry.id },
  })
}

export type RecordPaymentParams = {
  invoiceId: string
  amountCents: number
  date: Date
  cashAccountId: string
  arAccountId: string
  memo?: string
  bankAccountId?: string | null
  createdByUserId?: string | null
}

/** Record an invoice payment: DR Cash / CR AR. */
export async function recordInvoicePayment(params: RecordPaymentParams) {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: params.invoiceId } })
  if (!["SENT", "PARTIAL"].includes(invoice.status)) {
    throw new Error("Invoice is not in a payable state")
  }
  if (params.amountCents > invoice.amountDue) {
    throw new Error("Payment exceeds amount due")
  }

  const entry = await createAndPostEntry({
    tenantId: invoice.tenantId,
    entityId: invoice.entityId,
    date: params.date,
    memo: params.memo ?? `Payment for invoice ${invoice.invoiceNumber}`,
    source: "PAYMENT",
    sourceId: invoice.id,
    createdByUserId: params.createdByUserId,
    lines: [
      { accountId: params.cashAccountId, debit: params.amountCents },
      { accountId: params.arAccountId, credit: params.amountCents },
    ],
  })

  const newPaid = invoice.amountPaid + params.amountCents
  const newDue = invoice.total - newPaid
  const newStatus = newDue <= 0 ? "PAID" : "PARTIAL"

  const [payment] = await prisma.$transaction([
    prisma.invoicePayment.create({
      data: {
        invoiceId: params.invoiceId,
        date: params.date,
        amount: params.amountCents,
        bankAccountId: params.bankAccountId ?? null,
        journalEntryId: entry.id,
        memo: params.memo ?? null,
      },
    }),
    prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { amountPaid: newPaid, amountDue: newDue, status: newStatus },
    }),
  ])

  return { payment, entry }
}

/** Create a credit memo: DR Revenue / CR AR. */
export async function createCreditMemo(params: {
  tenantId: string
  entityId: string
  customerId: string
  invoiceId?: string | null
  amountCents: number
  date: Date
  memo?: string
  arAccountId: string
  revenueAccountId: string
  createdByUserId?: string | null
}) {
  const entry = await createAndPostEntry({
    tenantId: params.tenantId,
    entityId: params.entityId,
    date: params.date,
    memo: params.memo ?? "Credit memo",
    source: "INVOICE",
    createdByUserId: params.createdByUserId,
    lines: [
      { accountId: params.revenueAccountId, debit: params.amountCents },
      { accountId: params.arAccountId, credit: params.amountCents },
    ],
  })

  return prisma.creditMemo.create({
    data: {
      tenantId: params.tenantId,
      entityId: params.entityId,
      invoiceId: params.invoiceId ?? null,
      customerId: params.customerId,
      amount: params.amountCents,
      date: params.date,
      memo: params.memo ?? null,
      journalEntryId: entry.id,
    },
  })
}
