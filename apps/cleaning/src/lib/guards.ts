import "server-only"
import { getSession, type SessionPayload } from "./session"
import { canManageAccounts, canManageOrg, canInspect, canViewSchedule } from "./rbac"
import { orgHasCapability } from "./page-guards"
import { subscriptionBlock } from "./subscription/enforce"
import { unauthorized, forbidden } from "./api"

export type Guarded =
  | { ok: true; session: SessionPayload; orgId: string }
  | { ok: false; response: Response }

export type GuardedActor =
  | { ok: true; session: SessionPayload; orgId: string; userId: string }
  | { ok: false; response: Response }

/**
 * Per-guard enforcement options.
 *   • recovery: this route is part of the account-recovery surface (billing,
 *     payment-method management, data export). An administrator reaches it even
 *     when the subscription has lapsed, so they can always pay or export.
 */
export type GuardOptions = { recovery?: boolean }

/**
 * Guard for customer-account administration routes: requires a session, an
 * account-management role, and (optionally) a capability. Returns the session
 * and orgId, or a ready-to-return error Response.
 */
export async function requireAccountManager(requiredCap?: string, opts?: GuardOptions): Promise<Guarded> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (!canManageAccounts(session.role)) return { ok: false, response: forbidden() }
  if (requiredCap && !(await orgHasCapability(session.organizationId, requiredCap))) {
    return { ok: false, response: forbidden(`Missing capability: ${requiredCap}`) }
  }
  const blocked = await subscriptionBlock(session, opts)
  if (blocked) return { ok: false, response: blocked }
  return { ok: true, session, orgId: session.organizationId }
}

/** Field-execution guard: the actor must be a CLEANER. Assignment to a specific
 *  job is enforced in the data layer. Returns the authenticated actor's userId. */
export async function requireCleaner(requiredCap?: string, opts?: GuardOptions): Promise<GuardedActor> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (session.role !== "CLEANER") return { ok: false, response: forbidden() }
  if (requiredCap && !(await orgHasCapability(session.organizationId, requiredCap))) {
    return { ok: false, response: forbidden(`Missing capability: ${requiredCap}`) }
  }
  const blocked = await subscriptionBlock(session, opts)
  if (blocked) return { ok: false, response: blocked }
  return { ok: true, session, orgId: session.organizationId, userId: session.userId }
}

/**
 * Organization administration guard (OWNER/ADMIN). Deliberately NOT subscription-
 * gated: this is the recovery surface where billing, payment-method management,
 * and workspace settings live, so a lapsed org's administrator must always reach
 * it to pay. (Operational value for admins flows through requireAccountManager,
 * which IS gated.)
 */
export async function requireOrgAdmin(): Promise<Guarded> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (!canManageOrg(session.role)) return { ok: false, response: forbidden() }
  return { ok: true, session, orgId: session.organizationId }
}

/** Inspection guard: OWNER/ADMIN/MANAGER/SUPERVISOR (+ optional capability). */
export async function requireInspector(requiredCap?: string, opts?: GuardOptions): Promise<GuardedActor> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (!canInspect(session.role)) return { ok: false, response: forbidden() }
  if (requiredCap && !(await orgHasCapability(session.organizationId, requiredCap))) {
    return { ok: false, response: forbidden(`Missing capability: ${requiredCap}`) }
  }
  const blocked = await subscriptionBlock(session, opts)
  if (blocked) return { ok: false, response: blocked }
  return { ok: true, session, orgId: session.organizationId, userId: session.userId }
}

/** Operations guard for Issues: OWNER/ADMIN/MANAGER/SUPERVISOR (+ capability). */
export async function requireOperations(requiredCap?: string, opts?: GuardOptions): Promise<GuardedActor> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (!canViewSchedule(session.role)) return { ok: false, response: forbidden() }
  if (requiredCap && !(await orgHasCapability(session.organizationId, requiredCap))) {
    return { ok: false, response: forbidden(`Missing capability: ${requiredCap}`) }
  }
  const blocked = await subscriptionBlock(session, opts)
  if (blocked) return { ok: false, response: blocked }
  return { ok: true, session, orgId: session.organizationId, userId: session.userId }
}

/**
 * Internal-staff guard (any role except CLIENT) + optional capability. Used by
 * employee reporting (P2): every internal employee may FILE a report; who may
 * VIEW/INVESTIGATE is enforced per-report in the data layer by confidentiality.
 */
export async function requireStaff(requiredCap?: string, opts?: GuardOptions): Promise<GuardedActor> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  if (session.role === "CLIENT") return { ok: false, response: forbidden() }
  if (requiredCap && !(await orgHasCapability(session.organizationId, requiredCap))) {
    return { ok: false, response: forbidden(`Missing capability: ${requiredCap}`) }
  }
  const blocked = await subscriptionBlock(session, opts)
  if (blocked) return { ok: false, response: blocked }
  return { ok: true, session, orgId: session.organizationId, userId: session.userId }
}

/**
 * Any authenticated user (for self-service actions like changing own password).
 * NOT subscription-gated: authentication and account self-service must survive a
 * lapse so the customer can sign in and recover.
 */
export async function requireSession(): Promise<GuardedActor> {
  const session = await getSession()
  if (!session) return { ok: false, response: unauthorized() }
  return { ok: true, session, orgId: session.organizationId, userId: session.userId }
}
