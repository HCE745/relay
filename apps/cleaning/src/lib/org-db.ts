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
