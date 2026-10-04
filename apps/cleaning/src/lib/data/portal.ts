import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { orgDb, customerDb, systemDb } from "../org-db"
import { invoiceNo } from "../money"
import { ReferenceError, ForbiddenActionError } from "./errors"
import { Prisma } from "../../generated/prisma/client"

// Customer portal data access (Phase 16). THE ISOLATION BOUNDARY: every query
// goes through orgDb(orgId) (tenant isolation) AND is additionally constrained
// to the one customer the portal user belongs to — jobs/inspections/issues via
// `serviceLocation.customerId`, invoices via `customerId`. Projections expose
// ONLY customer-safe fields — never pay rates, labor cost, margins, internal
// notes, or other employees. Portal users are read-only except for reporting an
// issue against their own sites.

function balance(total: Prisma.Decimal, payments: { amount: Prisma.Decimal }[]): string {
  const paid = payments.reduce((acc, p) => acc.plus(p.amount), new Prisma.Decimal(0))
  return total.minus(paid).toFixed(2)
}

export async function getPortalDashboard(orgId: string, customerId: string) {
  // customerDb AND-s `customerId` (via serviceLocation/customerId) into every
  // query's where — isolation is enforced here, not by field-filtering results.
  const db = customerDb(orgId, customerId)
  const now = new Date()

  const [upcoming, completed, inspections, issues, invoicesRaw, customer] = await Promise.all([
    db.job.findMany({
      where: { status: { in: ["SCHEDULED", "ASSIGNED"] }, scheduledStart: { gte: now } },
      orderBy: { scheduledStart: "asc" },
      take: 25,
      select: { id: true, title: true, scheduledStart: true, serviceLocation: { select: { name: true } } },
    }),
    db.job.findMany({
      where: { status: "COMPLETED" },
      orderBy: { scheduledStart: "desc" },
      take: 25,
      select: {
        id: true, title: true, scheduledStart: true, actualEnd: true,
        serviceLocation: { select: { name: true } },
        photos: { select: { id: true, caption: true }, take: 12 },
      },
    }),
    db.inspection.findMany({
      where: { status: "FINALIZED" },
      orderBy: { finalizedAt: "desc" },
      take: 25,
      select: { id: true, score: true, outcome: true, finalizedAt: true, serviceLocation: { select: { name: true } } },
    }),
    db.issue.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, description: true, status: true, source: true, createdAt: true, resolvedAt: true, serviceLocation: { select: { name: true } } },
    }),
    db.invoice.findMany({
      where: { status: { not: "VOID" } },
      orderBy: { invoiceNumber: "desc" },
      take: 50,
      select: { id: true, invoiceNumber: true, status: true, total: true, currency: true, issueDate: true, dueDate: true, payments: { select: { amount: true } } },
    }),
    db.customer.findFirst({ select: { id: true, name: true } }),
  ])

  const invoices = invoicesRaw.map((inv) => ({
    id: inv.id, number: invoiceNo(inv.invoiceNumber), status: inv.status, currency: inv.currency,
    total: inv.total.toString(), balance: balance(inv.total, inv.payments), issueDate: inv.issueDate, dueDate: inv.dueDate,
  }))

  return { customer, upcoming, completed, inspections, issues, invoices }
}

/** The customer's sites — for the report-issue picker. */
export function listPortalSites(orgId: string, customerId: string) {
  return customerDb(orgId, customerId).serviceLocation.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
}

/** A portal user reports an issue — only against a site they own. Source CUSTOMER. */
export async function reportPortalIssue(
  orgId: string,
  customerId: string,
  reporterId: string,
  input: { serviceLocationId: string; title?: string; description: string },
) {
  // Ownership is proven by a customer-scoped read (returns null for a site that
  // isn't this customer's); the write then goes through orgDb.
  const site = await customerDb(orgId, customerId).serviceLocation.findFirst({ where: { id: input.serviceLocationId }, select: { id: true } })
  if (!site) throw new ReferenceError("That site is not on your account")
  const issue = await orgDb(orgId).issue.create({
    data: {
      organizationId: orgId, serviceLocationId: input.serviceLocationId, reportedById: reporterId,
      source: "CUSTOMER", title: input.title ?? null, description: input.description, status: "OPEN",
    },
    select: { id: true },
  })
  return { id: issue.id }
}

// ── Direct by-ID portal reads (customer-scoped at the query level) ──
// Each returns null when the id belongs to another customer — a direct request
// cannot read across customers, it does not return a filtered object.
export function getPortalPhoto(orgId: string, customerId: string, photoId: string) {
  return customerDb(orgId, customerId).jobPhoto.findFirst({ where: { id: photoId }, select: { storageKey: true, contentType: true } })
}
export function getPortalInvoiceById(orgId: string, customerId: string, id: string) {
  return customerDb(orgId, customerId).invoice.findFirst({ where: { id }, select: { id: true, invoiceNumber: true, total: true } })
}
export function getPortalJobById(orgId: string, customerId: string, id: string) {
  return customerDb(orgId, customerId).job.findFirst({ where: { id }, select: { id: true, title: true } })
}
export function getPortalInspectionById(orgId: string, customerId: string, id: string) {
  return customerDb(orgId, customerId).inspection.findFirst({ where: { id }, select: { id: true, score: true } })
}

// ── Portal authentication ──
export async function portalLogin(email: string, password: string) {
  const user = await systemDb.user.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true, email: true, name: true, password: true, role: true, isActive: true, customerId: true, organizationId: true } })
  if (!user || user.role !== "CLIENT" || !user.isActive || !user.customerId) return null
  if (!(await bcrypt.compare(password, user.password))) return null
  return { userId: user.id, email: user.email, name: user.name, customerId: user.customerId, organizationId: user.organizationId }
}

// ── Invites (admin side) ──
export async function listPortalUsers(orgId: string, customerId: string) {
  return orgDb(orgId).user.findMany({ where: { role: "CLIENT", customerId }, select: { id: true, name: true, email: true, isActive: true }, orderBy: { name: "asc" } })
}

export async function listPortalInvites(orgId: string, customerId: string) {
  return orgDb(orgId).portalInvite.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, status: true, expiresAt: true, createdAt: true } })
}

/**
 * Invite a customer contact. Creates a CLIENT user (inactive until accepted,
 * random password) scoped to the customer + a tokenized invite. Returns the
 * accept link so the caller can email it or show it (email-unconfigured fallback).
 */
export async function createPortalInvite(orgId: string, customerId: string, email: string, invitedById: string, appUrl: string) {
  const db = orgDb(orgId)
  const normalized = email.toLowerCase().trim()
  const customer = await db.customer.findFirst({ where: { id: customerId }, select: { id: true, name: true } })
  if (!customer) throw new ReferenceError("Customer not found")

  const existing = await systemDb.user.findUnique({ where: { email: normalized }, select: { id: true, role: true, customerId: true, organizationId: true } })
  if (existing) {
    // Only reuse if it's already this customer's portal user; never attach to staff.
    if (existing.role !== "CLIENT" || existing.customerId !== customerId || existing.organizationId !== orgId) {
      throw new ForbiddenActionError("That email already belongs to another account")
    }
  } else {
    const placeholder = await bcrypt.hash(randomBytes(24).toString("hex"), 10)
    await db.user.create({
      data: { organizationId: orgId, customerId, email: normalized, name: email.split("@")[0], role: "CLIENT", password: placeholder, isActive: false },
    })
  }

  const token = randomBytes(24).toString("base64url")
  const expiresAt = new Date(Date.now() + 7 * 86_400_000)
  await db.portalInvite.create({ data: { organizationId: orgId, customerId, email: normalized, token, invitedById, expiresAt } })
  return { token, link: `${appUrl}/portal/accept?token=${token}`, email: normalized }
}

export async function acceptPortalInvite(token: string, password: string) {
  const invite = await systemDb.portalInvite.findUnique({ where: { token }, select: { id: true, organizationId: true, customerId: true, email: true, status: true, expiresAt: true } })
  if (!invite || invite.status !== "PENDING" || invite.expiresAt.getTime() < Date.now()) return null
  const user = await systemDb.user.findUnique({ where: { email: invite.email }, select: { id: true, role: true, customerId: true } })
  if (!user || user.role !== "CLIENT" || user.customerId !== invite.customerId) return null
  const hashed = await bcrypt.hash(password, 10)
  await systemDb.$transaction([
    systemDb.user.update({ where: { id: user.id }, data: { password: hashed, isActive: true } }),
    systemDb.portalInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedUserId: user.id } }),
  ])
  return { userId: user.id }
}
