import { orgDb } from "../org-db"
import { formatMoney, invoiceNo } from "../money"
import { ZERO, remainingBalance } from "../billing-math"

// Essentials for the slide-over detail panels (Part 2). Each returns a compact,
// normalized shape the panel renders generically, plus the full-page href for
// "everything else". Presentation only — no new data, no writes.

export type PeekField = { label: string; value: string }
export type PeekData = { kind: string; title: string; subtitle?: string; href: string; fullLabel: string; fields: PeekField[] }

const d = (x: Date | null | undefined) => (x ? new Date(x).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-")
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

export async function peekJob(orgId: string, id: string): Promise<PeekData | null> {
  const j = await orgDb(orgId).job.findFirst({
    where: { id },
    select: {
      id: true, title: true, status: true, scheduledStart: true, scheduledEnd: true, crewSize: true,
      serviceLocation: { select: { name: true, customer: { select: { name: true } } } },
      assignments: { select: { user: { select: { name: true } } } },
      checklistItems: { select: { isComplete: true } },
    },
  })
  if (!j) return null
  const done = j.checklistItems.filter((c) => c.isComplete).length
  return {
    kind: "Job", title: j.title, subtitle: j.serviceLocation ? `${j.serviceLocation.customer.name} · ${j.serviceLocation.name}` : undefined,
    href: `/jobs/${j.id}`, fullLabel: "Open full job",
    fields: [
      { label: "Status", value: title(j.status) },
      { label: "Scheduled", value: d(j.scheduledStart) },
      { label: "Crew", value: j.assignments.length ? j.assignments.map((a) => a.user.name).join(", ") : `0 of ${j.crewSize ?? 1}` },
      { label: "Checklist", value: j.checklistItems.length ? `${done} of ${j.checklistItems.length} done` : "-" },
    ],
  }
}

export async function peekCustomer(orgId: string, id: string): Promise<PeekData | null> {
  const c = await orgDb(orgId).customer.findFirst({
    where: { id },
    select: { id: true, name: true, primaryContactName: true, email: true, phone: true, _count: { select: { serviceLocations: true } } },
  })
  if (!c) return null
  return {
    kind: "Customer", title: c.name, href: `/customers/${c.id}`, fullLabel: "Open full customer",
    fields: [
      { label: "Contact", value: c.primaryContactName || "-" },
      { label: "Phone", value: c.phone || "-" },
      { label: "Email", value: c.email || "-" },
      { label: "Sites", value: String(c._count.serviceLocations) },
    ],
  }
}

export async function peekInvoice(orgId: string, id: string): Promise<PeekData | null> {
  const inv = await orgDb(orgId).invoice.findFirst({
    where: { id },
    select: { id: true, invoiceNumber: true, status: true, total: true, currency: true, dueDate: true, customer: { select: { name: true } }, payments: { select: { amount: true } } },
  })
  if (!inv) return null
  const paid = inv.payments.reduce((a, p) => a.plus(p.amount), ZERO)
  return {
    kind: "Invoice", title: invoiceNo(inv.invoiceNumber), subtitle: inv.customer.name, href: `/billing/invoices/${inv.id}`, fullLabel: "Open full invoice",
    fields: [
      { label: "Status", value: title(inv.status) },
      { label: "Total", value: formatMoney(inv.total, inv.currency) },
      { label: "Balance", value: formatMoney(remainingBalance(inv.total, paid), inv.currency) },
      { label: "Due", value: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-" },
    ],
  }
}

export async function peekIssue(orgId: string, id: string): Promise<PeekData | null> {
  const i = await orgDb(orgId).issue.findFirst({
    where: { id },
    select: { id: true, title: true, description: true, status: true, severity: true, category: true, assignedTo: { select: { name: true } }, serviceLocation: { select: { name: true } } },
  })
  if (!i) return null
  return {
    kind: "Issue", title: i.title ?? i.description.slice(0, 60), subtitle: i.serviceLocation?.name ?? undefined, href: `/issues/${i.id}`, fullLabel: "Open full issue",
    fields: [
      { label: "Status", value: title(i.status) },
      { label: "Severity", value: title(i.severity) },
      { label: "Category", value: title(i.category) },
      { label: "Owner", value: i.assignedTo?.name ?? "Unassigned" },
    ],
  }
}

export async function peekEmployee(orgId: string, id: string): Promise<PeekData | null> {
  const u = await orgDb(orgId).user.findFirst({
    where: { id, role: { not: "CLIENT" } },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, employeeProfile: { select: { employeeCode: true } } },
  })
  if (!u) return null
  return {
    kind: "Employee", title: u.name, subtitle: title(u.role), href: `/team`, fullLabel: "Open Team",
    fields: [
      { label: "Status", value: u.isActive ? "Active" : "Inactive" },
      { label: "Phone", value: u.phone || "-" },
      { label: "Email", value: u.email || "-" },
      { label: "Code", value: u.employeeProfile?.employeeCode || "-" },
    ],
  }
}
