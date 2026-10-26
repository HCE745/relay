import { orgDb } from "../org-db"
import { canManageAccounts, canViewSchedule, canManageTeam } from "../rbac"
import { invoiceNo } from "../money"

// Global search for the command palette (presentation only). Results are scoped
// by BOTH capability (the org's plan) and role (what this person can reach), so
// a supervisor never sees a billing result for a screen they can't open.

export type SearchResult = { type: string; id: string; label: string; sublabel?: string; href: string }

type Ctx = { role: string; has: (cap: string) => boolean }
const LIMIT = 5
const insensitive = "insensitive" as const

export async function globalSearch(orgId: string, qRaw: string, ctx: Ctx): Promise<SearchResult[]> {
  const q = qRaw.trim()
  if (q.length < 1) return []
  const db = orgDb(orgId)
  const contains = { contains: q, mode: insensitive }
  const can = (cap: string, roleOk: boolean) => ctx.has(cap) && roleOk
  const accounts = canManageAccounts(ctx.role)
  const schedule = canViewSchedule(ctx.role)
  const team = canManageTeam(ctx.role)

  const tasks: Promise<SearchResult[]>[] = []

  if (can("core.customers", accounts)) tasks.push(
    db.customer.findMany({ where: { name: contains }, take: LIMIT, select: { id: true, name: true } })
      .then((rows) => rows.map((r) => ({ type: "Customer", id: r.id, label: r.name, href: `/customers/${r.id}` }))))

  if (can("core.locations", accounts)) tasks.push(
    db.serviceLocation.findMany({ where: { name: contains }, take: LIMIT, select: { id: true, name: true, customerId: true, customer: { select: { name: true } } } })
      .then((rows) => rows.map((r) => ({ type: "Site", id: r.id, label: r.name, sublabel: r.customer.name, href: `/customers/${r.customerId}/sites/${r.id}` }))))

  if (can("core.jobs", schedule)) tasks.push(
    db.job.findMany({ where: { title: contains }, orderBy: { scheduledStart: "desc" }, take: LIMIT, select: { id: true, title: true, serviceLocation: { select: { name: true } } } })
      .then((rows) => rows.map((r) => ({ type: "Job", id: r.id, label: r.title, sublabel: r.serviceLocation?.name ?? undefined, href: `/jobs/${r.id}` }))))

  if (can("workforce.employees", team)) tasks.push(
    db.user.findMany({ where: { role: { not: "CLIENT" }, OR: [{ name: contains }, { email: contains }] }, take: LIMIT, select: { id: true, name: true, role: true } })
      .then((rows) => rows.map((r) => ({ type: "Employee", id: r.id, label: r.name, sublabel: r.role.charAt(0) + r.role.slice(1).toLowerCase(), href: `/team` }))))

  if (can("billing.invoicing", accounts)) {
    const n = Number(q.replace(/\D/g, ""))
    tasks.push(
      db.invoice.findMany({ where: { OR: [{ customer: { name: contains } }, ...(Number.isFinite(n) && n > 0 ? [{ invoiceNumber: n }] : [])] }, orderBy: { invoiceNumber: "desc" }, take: LIMIT, select: { id: true, invoiceNumber: true, status: true, customer: { select: { name: true } } } })
        .then((rows) => rows.map((r) => ({ type: "Invoice", id: r.id, label: invoiceNo(r.invoiceNumber), sublabel: `${r.customer.name} · ${r.status.toLowerCase()}`, href: `/billing/invoices/${r.id}` }))))
  }

  if (can("operations.issues", schedule)) tasks.push(
    db.issue.findMany({ where: { OR: [{ title: contains }, { description: contains }] }, orderBy: { createdAt: "desc" }, take: LIMIT, select: { id: true, title: true, description: true, status: true } })
      .then((rows) => rows.map((r) => ({ type: "Issue", id: r.id, label: r.title ?? r.description.slice(0, 50), sublabel: r.status.toLowerCase(), href: `/issues/${r.id}` }))))

  if (can("operations.workOrders", accounts)) tasks.push(
    db.workOrder.findMany({ where: { description: contains }, orderBy: { createdAt: "desc" }, take: LIMIT, select: { id: true, description: true, type: true, status: true } })
      .then((rows) => rows.map((r) => ({ type: "Work order", id: r.id, label: r.description.slice(0, 50), sublabel: r.status.toLowerCase(), href: `/work-orders` }))))

  const groups = await Promise.all(tasks)
  return groups.flat()
}
