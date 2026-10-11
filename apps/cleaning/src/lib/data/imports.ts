import { randomUUID } from "node:crypto"
import { orgDb } from "../org-db"
import { assertFound, ConflictError, RequirementsError } from "./errors"

// Customer CSV import (Phase 23): one row per service location, with the owning
// customer's columns repeated and an optional contact. Rows are grouped into
// customers; a customer already in the org is a DUPLICATE (skipped, reported).
// Commit is all-or-nothing: any hard error aborts the whole import.

export const IMPORT_COLUMNS = [
  "customer_name", "customer_email", "customer_phone",
  "site_name", "site_address", "site_city", "site_state", "site_postal",
  "contact_name", "contact_email", "contact_phone",
] as const

export function importTemplateCsv(): string {
  const example = ["Acme Offices", "ap@acme.com", "512-555-0100", "Acme HQ", "100 Main St", "Austin", "TX", "78701", "Dana Reed", "dana@acme.com", "512-555-0101"]
  return IMPORT_COLUMNS.join(",") + "\n" + example.map(csvCell).join(",") + "\n"
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const norm = (s?: string) => (s ?? "").trim().toLowerCase()
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

/** Minimal RFC4180-ish CSV parser (quotes, embedded commas/newlines, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false }
      else cell += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = "" }
    else cell += c
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

type RawRow = Record<(typeof IMPORT_COLUMNS)[number], string>
type ParsedRow = { line: number; data: RawRow; errors: string[] }

function toRows(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const grid = parseCsv(text)
  if (grid.length === 0) return { rows: [], headerError: "The file is empty." }
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const missing = IMPORT_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length) return { rows: [], headerError: `Missing required columns: ${missing.join(", ")}. Download the template.` }
  const idx = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<string, number>
  const rows: ParsedRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const g = grid[r]
    const data = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, (g[idx[c]] ?? "").trim()])) as RawRow
    const errors: string[] = []
    if (!data.customer_name) errors.push("customer_name is required")
    if (data.customer_email && !emailOk(data.customer_email)) errors.push(`invalid customer_email "${data.customer_email}"`)
    if (data.contact_email && !emailOk(data.contact_email)) errors.push(`invalid contact_email "${data.contact_email}"`)
    rows.push({ line: r + 1, data, errors })
  }
  return { rows, headerError: null }
}

function customerKey(d: RawRow) { return norm(d.customer_name) + "|" + norm(d.customer_email) }

export type ImportPreview = {
  headerError: string | null
  errorCount: number
  rows: { line: number; customer: string; site: string; contact: string; status: "create" | "duplicate" | "error"; errors: string[] }[]
  summary: { customersToCreate: number; sitesToCreate: number; contactsToCreate: number; duplicates: number; errors: number }
}

export async function buildImportPreview(orgId: string, text: string): Promise<ImportPreview> {
  const { rows, headerError } = toRows(text)
  if (headerError) return { headerError, errorCount: 1, rows: [], summary: { customersToCreate: 0, sitesToCreate: 0, contactsToCreate: 0, duplicates: 0, errors: 1 } }

  // Existing customers in the org → duplicate detection by name or email.
  const existing = await orgDb(orgId).customer.findMany({ select: { name: true, email: true } })
  const existingNames = new Set(existing.map((c) => norm(c.name)))
  const existingEmails = new Set(existing.filter((c) => c.email).map((c) => norm(c.email!)))

  const seenNewCustomers = new Set<string>()
  let customersToCreate = 0, sitesToCreate = 0, contactsToCreate = 0, duplicates = 0, errorCount = 0
  const outRows: ImportPreview["rows"] = []

  for (const row of rows) {
    const d = row.data
    const isDupExisting = existingNames.has(norm(d.customer_name)) || (!!d.customer_email && existingEmails.has(norm(d.customer_email)))
    let status: "create" | "duplicate" | "error" = "create"
    if (row.errors.length) { status = "error"; errorCount++ }
    else if (isDupExisting) { status = "duplicate"; duplicates++ }
    else {
      const key = customerKey(d)
      if (!seenNewCustomers.has(key)) { seenNewCustomers.add(key); customersToCreate++; if (d.contact_name) contactsToCreate++ }
      if (d.site_name) sitesToCreate++
    }
    outRows.push({ line: row.line, customer: d.customer_name, site: d.site_name, contact: d.contact_name, status, errors: row.errors })
  }
  return { headerError: null, errorCount, rows: outRows, summary: { customersToCreate, sitesToCreate, contactsToCreate, duplicates, errors: errorCount } }
}

/** Commit the import atomically. Any hard error aborts the whole import. */
export async function commitImport(orgId: string, text: string, createdById: string, filename?: string) {
  const { rows, headerError } = toRows(text)
  if (headerError) throw new RequirementsError(headerError, [headerError])
  const rowErrors = rows.filter((r) => r.errors.length)
  if (rowErrors.length) {
    throw new RequirementsError(
      `Import aborted — ${rowErrors.length} row(s) have errors. Nothing was imported.`,
      rowErrors.map((r) => `Line ${r.line}: ${r.errors.join("; ")}`),
    )
  }

  const existing = await orgDb(orgId).customer.findMany({ select: { name: true, email: true } })
  const existingNames = new Set(existing.map((c) => norm(c.name)))
  const existingEmails = new Set(existing.filter((c) => c.email).map((c) => norm(c.email!)))

  // Group non-duplicate rows into customers.
  const groups = new Map<string, { d: RawRow; sites: RawRow[] }>()
  for (const row of rows) {
    const d = row.data
    if (existingNames.has(norm(d.customer_name)) || (!!d.customer_email && existingEmails.has(norm(d.customer_email)))) continue // skip duplicates
    const key = customerKey(d)
    const g = groups.get(key) ?? groups.set(key, { d, sites: [] }).get(key)!
    if (d.site_name) g.sites.push(d)
  }

  const batchId = randomUUID()
  let customersCreated = 0, sitesCreated = 0, contactsCreated = 0

  await orgDb(orgId).$transaction(async (tx) => {
    await tx.importBatch.create({ data: { id: batchId, organizationId: orgId, filename, createdById } })
    for (const { d, sites } of groups.values()) {
      const customer = await tx.customer.create({
        data: {
          organizationId: orgId, name: d.customer_name, email: d.customer_email || null, phone: d.customer_phone || null,
          primaryContactName: d.contact_name || null, importBatchId: batchId,
        },
        select: { id: true },
      })
      customersCreated++
      if (d.contact_name) {
        await tx.contact.create({ data: { organizationId: orgId, customerId: customer.id, name: d.contact_name, email: d.contact_email || null, phone: d.contact_phone || null, isPrimary: true, importBatchId: batchId } })
        contactsCreated++
      }
      for (const s of sites) {
        await tx.serviceLocation.create({
          data: {
            organizationId: orgId, customerId: customer.id, name: s.site_name,
            addressLine1: s.site_address || null, city: s.site_city || null, state: s.site_state || null, postalCode: s.site_postal || null,
            importBatchId: batchId,
          },
        })
        sitesCreated++
      }
    }
    await tx.importBatch.updateMany({ where: { id: batchId }, data: { customersCreated, sitesCreated, contactsCreated } })
  })

  return { batchId, customersCreated, sitesCreated, contactsCreated }
}

export function listImportBatches(orgId: string) {
  return orgDb(orgId).importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 25 })
}

/**
 * Roll back the MOST RECENT non-rolled-back import. Refuses if any imported
 * customer already has activity (jobs or invoices) — we never cascade-delete
 * real operational data.
 */
export async function rollbackImport(orgId: string, batchId: string) {
  const db = orgDb(orgId)
  const batch = await db.importBatch.findFirst({ where: { id: batchId } })
  assertFound(batch, "Import")
  if (batch!.rolledBackAt) throw new ConflictError("This import was already rolled back")
  const latest = await db.importBatch.findFirst({ where: { rolledBackAt: null }, orderBy: { createdAt: "desc" }, select: { id: true } })
  if (latest?.id !== batchId) throw new ConflictError("Only the most recent import can be rolled back")

  const importedCustomers = await db.customer.findMany({ where: { importBatchId: batchId }, select: { id: true } })
  const custIds = importedCustomers.map((c) => c.id)
  if (custIds.length) {
    const [jobs, invoices] = await Promise.all([
      db.job.count({ where: { serviceLocation: { customerId: { in: custIds } } } }),
      db.invoice.count({ where: { customerId: { in: custIds } } }),
    ])
    if (jobs > 0 || invoices > 0) throw new ConflictError("Some imported customers already have jobs or invoices — roll back can't delete active data")
  }
  // Deleting customers cascades their sites + contacts (both FK onDelete:Cascade).
  await db.$transaction([
    db.customer.deleteMany({ where: { importBatchId: batchId } }),
    db.importBatch.updateMany({ where: { id: batchId }, data: { rolledBackAt: new Date() } }),
  ])
  return { rolledBack: custIds.length }
}
