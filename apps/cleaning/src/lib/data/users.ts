import bcrypt from "bcryptjs"
import { orgDb, isUniqueViolation } from "../org-db"
import { assertFound, ForbiddenActionError, ConflictError } from "./errors"
import type { z } from "zod"
import type { userCreateSchema, userUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof userCreateSchema>
type UpdateInput = z.infer<typeof userUpdateSchema>

// Only OWNER/ADMIN may create or modify OWNER/ADMIN accounts; MANAGER is limited
// to SUPERVISOR/CLEANER (enforced here, not just in the UI).
function assertCanAssign(actorRole: string, targetRole: string) {
  if ((targetRole === "OWNER" || targetRole === "ADMIN") && !(actorRole === "OWNER" || actorRole === "ADMIN")) {
    throw new ForbiddenActionError("Only owners and admins can assign the OWNER/ADMIN role")
  }
}
function assertCanManageTarget(actorRole: string, targetRole: string) {
  if ((targetRole === "OWNER" || targetRole === "ADMIN") && !(actorRole === "OWNER" || actorRole === "ADMIN")) {
    throw new ForbiddenActionError("Only owners and admins can manage this account")
  }
}

const profileSelect = { select: { employeeCode: true, payType: true, payRate: true, hireDate: true, employmentStatus: true } }

export function listUsers(orgId: string) {
  return orgDb(orgId).user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { employeeProfile: profileSelect },
  })
}

export function getUser(orgId: string, id: string) {
  return orgDb(orgId).user.findFirst({ where: { id }, include: { employeeProfile: true } })
}

export async function createUser(orgId: string, actorRole: string, input: CreateInput) {
  assertCanAssign(actorRole, input.role)
  const hashed = await bcrypt.hash(input.password, 10)
  try {
    return await orgDb(orgId).user.create({
      data: {
        organizationId: orgId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        password: hashed,
        isActive: input.isActive ?? true,
        employeeProfile: {
          create: {
            organizationId: orgId,
            employeeCode: input.employeeCode,
            payType: input.payType ?? "HOURLY",
            payRate: input.payRate,
            hireDate: input.hireDate,
          },
        },
      },
      include: { employeeProfile: true },
    })
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("That email is already in use")
    throw e
  }
}

export async function updateUser(orgId: string, actorRole: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const existing = await db.user.findFirst({ where: { id }, select: { id: true, role: true } })
  if (!existing) return null
  assertCanManageTarget(actorRole, existing.role)
  if (input.role) assertCanAssign(actorRole, input.role)

  const userData: Record<string, unknown> = {}
  if (input.name !== undefined) userData.name = input.name
  if (input.phone !== undefined) userData.phone = input.phone
  if (input.role !== undefined) userData.role = input.role
  if (input.isActive !== undefined) userData.isActive = input.isActive
  if (Object.keys(userData).length) await db.user.updateMany({ where: { id }, data: userData })

  // Upsert the employee profile (upsert is blocked on the org-scoped client).
  const profileData = {
    employeeCode: input.employeeCode,
    payType: input.payType,
    payRate: input.payRate,
    hireDate: input.hireDate,
    employmentStatus: input.employmentStatus,
  }
  if (Object.values(profileData).some((v) => v !== undefined)) {
    const prof = await db.employeeProfile.findFirst({ where: { userId: id }, select: { id: true } })
    if (prof) await db.employeeProfile.updateMany({ where: { userId: id }, data: profileData })
    else await db.employeeProfile.create({ data: { organizationId: orgId, userId: id, ...profileData } })
  }

  return getUser(orgId, id)
}

/** Admin-set password (temporary credential issuance / reset by a manager). */
export async function setUserPassword(orgId: string, actorRole: string, id: string, newPassword: string) {
  const db = orgDb(orgId)
  const existing = await db.user.findFirst({ where: { id }, select: { role: true } })
  assertFound(existing, "User")
  assertCanManageTarget(actorRole, existing!.role)
  await db.user.updateMany({ where: { id }, data: { password: await bcrypt.hash(newPassword, 10) } })
  return { ok: true }
}
