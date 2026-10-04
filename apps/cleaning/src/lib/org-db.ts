import { prisma } from "./prisma"

// ─── Organization-scoped Prisma client ───────────────────────────────────────
//
// `orgDb(organizationId)` returns a Prisma client extension that makes tenant
// isolation the DEFAULT rather than something every query must remember:
//
//   • reads/aggregates on tenant models get `organizationId` AND-ed into `where`
//   • creates have `organizationId` forced into `data` (client value ignored)
//   • a client-supplied `organizationId` can never widen scope — it is AND-ed
//     with the session org, so a mismatched value simply matches nothing
//   • by-unique operations (findUnique/update/delete/upsert) are BLOCKED on
//     tenant models, because their `where` cannot carry `organizationId`; callers
//     must use findFirst/updateMany/deleteMany with an id filter, which ARE
//     auto-scoped. This turns a silent cross-org footgun into a loud error.
//
// System/admin work that must cross orgs (auth lookup by email, super-admin,
// migrations) uses the unscoped `systemDb` export explicitly.
//
// This is intentionally Cleaning-only — not a generalized multi-product layer.

export const systemDb = prisma

// Tenant models = those carrying an `organizationId` column. Models scoped only
// through a parent (ChecklistTemplateItem→template, JobChecklistItem→job) are
// NOT listed; callers reach them via the parent, whose org is enforced here.
export const ORG_SCOPED_MODELS: ReadonlySet<string> = new Set([
  "User",
  "EmployeeProfile",
  "Customer",
  "Contact",
  "ServiceLocation",
  "ChecklistTemplate",
  "ServicePlan",
  "Job",
  "JobAssignment",
  "TimeEntry",
  "AuditEvent",
  "JobPhoto",
  "Issue",
  "InspectionTemplate",
  "Inspection",
  "IssueComment",
  "Invoice",
  "Lead",
  "Estimate",
  "Asset",
  "Supply",
  "SupplyUsage",
  "Contract",
])

const WHERE_OPS: ReadonlySet<string> = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
  "aggregate",
  "groupBy",
  "count",
])

const CREATE_OPS: ReadonlySet<string> = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
])

const BLOCKED_OPS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
])

export class OrgScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OrgScopeError"
  }
}

/** True for a Prisma unique-constraint violation (P2002) — used for idempotency. */
export function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002"
}

type AnyArgs = Record<string, unknown> | undefined

function injectWhere(args: AnyArgs, orgId: string): AnyArgs {
  const a = (args ?? {}) as Record<string, unknown>
  const existing = a.where as Record<string, unknown> | undefined
  return { ...a, where: { AND: [{ organizationId: orgId }, ...(existing ? [existing] : [])] } }
}

function injectData(operation: string, args: AnyArgs, orgId: string): AnyArgs {
  const a = (args ?? {}) as Record<string, unknown>
  if (operation === "create") {
    return { ...a, data: { ...(a.data as object), organizationId: orgId } }
  }
  // createMany / createManyAndReturn — data may be an array or a single object.
  const data = a.data
  const scoped = Array.isArray(data)
    ? data.map((d) => ({ ...(d as object), organizationId: orgId }))
    : { ...(data as object), organizationId: orgId }
  return { ...a, data: scoped }
}

/**
 * Pure transform used by the client extension. Exported for unit testing the
 * isolation logic without a database.
 */
export function scopeArgs(model: string, operation: string, args: AnyArgs, orgId: string): AnyArgs {
  if (!ORG_SCOPED_MODELS.has(model)) return args
  if (BLOCKED_OPS.has(operation)) {
    throw new OrgScopeError(
      `${operation} on ${model} is not allowed on the org-scoped client — its where cannot carry organizationId. Use findFirst/updateMany/deleteMany with an id filter instead.`,
    )
  }
  if (CREATE_OPS.has(operation)) return injectData(operation, args, orgId)
  if (WHERE_OPS.has(operation)) return injectWhere(args, orgId)
  return args
}

/** Build an organization-scoped Prisma client for the authenticated org. */
export function orgDb(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as AnyArgs, organizationId) as never)
        },
      },
    },
  })
}

export type OrgDb = ReturnType<typeof orgDb>

// ─── Customer-scoped (portal) client — Phase 16 ──────────────────────────────
//
// The customer portal is a SECOND isolation boundary INSIDE a tenant: a CLIENT
// user may read only their own customer's data. `customerDb(orgId, customerId)`
// enforces this the SAME way `orgDb` enforces org isolation — the customer
// predicate is AND-ed into every query's `where` at the data layer, never
// filtered on results fetched by id. It is READ-ONLY and exposes ONLY the
// portal-safe models; any other model, any write, and any by-unique op throw.
// So a findFirst({ where: { id } }) for another customer's row returns null.

type CustomerFilter = (customerId: string) => Record<string, unknown>
export const PORTAL_CUSTOMER_MODELS: Record<string, CustomerFilter> = {
  Customer: (c) => ({ id: c }),
  ServiceLocation: (c) => ({ customerId: c }),
  Invoice: (c) => ({ customerId: c }),
  Job: (c) => ({ serviceLocation: { customerId: c } }),
  Inspection: (c) => ({ serviceLocation: { customerId: c } }),
  Issue: (c) => ({ serviceLocation: { customerId: c } }),
  JobPhoto: (c) => ({
    OR: [{ job: { serviceLocation: { customerId: c } } }, { inspection: { serviceLocation: { customerId: c } } }],
  }),
}

// Pure reads only — no writes, no by-unique ops (whose where can't carry the
// predicate). Writes/admin work use orgDb with explicit validation.
const PORTAL_READ_OPS: ReadonlySet<string> = new Set(["findFirst", "findFirstOrThrow", "findMany", "aggregate", "count", "groupBy"])

/** Pure transform for the portal client. Exported for unit testing isolation. */
export function scopeCustomerArgs(
  model: string,
  operation: string,
  args: AnyArgs,
  orgId: string,
  customerId: string,
): AnyArgs {
  const filter = PORTAL_CUSTOMER_MODELS[model]
  if (!filter) {
    throw new OrgScopeError(`${model} is not reachable from the customer-portal client (portal can read only its own customer's data).`)
  }
  if (!PORTAL_READ_OPS.has(operation)) {
    throw new OrgScopeError(`${operation} on ${model} is not allowed on the read-only customer-portal client. Use findFirst/findMany; writes go through orgDb with explicit validation.`)
  }
  const a = (args ?? {}) as Record<string, unknown>
  const existing = a.where as Record<string, unknown> | undefined
  // org AND customer AND the caller's own predicate — a mismatched id matches nothing.
  return { ...a, where: { AND: [{ organizationId: orgId }, filter(customerId), ...(existing ? [existing] : [])] } }
}

/** Build a customer-scoped, read-only portal client. */
export function customerDb(organizationId: string, customerId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeCustomerArgs(model, operation, args as AnyArgs, organizationId, customerId) as never)
        },
      },
    },
  })
}
