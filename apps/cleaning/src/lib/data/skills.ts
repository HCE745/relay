import { orgDb } from "../org-db"
import { assertFound } from "./errors"

// Skills catalog + assignment (Phase 47). The catalog is an org list of
// competencies; employees hold skills; sites require them. The coverage finder
// reads these to rank candidates. All writes are org-scoped through orgDb.

export async function listSkills(orgId: string) {
  const skills = await orgDb(orgId).skill.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] })
  return skills.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))
}

export async function createSkill(orgId: string, name: string) {
  return orgDb(orgId).skill.create({ data: { organizationId: orgId, name: name.trim() } })
}

export async function deactivateSkill(orgId: string, id: string) {
  const res = await orgDb(orgId).skill.updateMany({ where: { id }, data: { isActive: false } })
  assertFound(res.count > 0 ? {} : null, "Skill")
  // Remove the skill from assignments and site requirements so matching stays clean.
  await orgDb(orgId).employeeSkill.deleteMany({ where: { skillId: id } })
  await orgDb(orgId).siteSkillRequirement.deleteMany({ where: { skillId: id } })
  return { ok: true }
}

/** Everything the skills management page needs: catalog + per-employee + per-site assignments. */
export async function getSkillMatrix(orgId: string) {
  const db = orgDb(orgId)
  const [skills, employees, empSkills, sites, siteReqs] = await Promise.all([
    db.skill.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { isActive: true, role: { in: ["CLEANER", "SUPERVISOR"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employeeSkill.findMany({ select: { userId: true, skillId: true } }),
    db.serviceLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.siteSkillRequirement.findMany({ select: { serviceLocationId: true, skillId: true } }),
  ])
  const byUser = new Map<string, string[]>()
  for (const e of empSkills) byUser.set(e.userId, [...(byUser.get(e.userId) ?? []), e.skillId])
  const bySite = new Map<string, string[]>()
  for (const r of siteReqs) bySite.set(r.serviceLocationId, [...(bySite.get(r.serviceLocationId) ?? []), r.skillId])
  return {
    skills,
    employees: employees.map((u) => ({ ...u, skillIds: byUser.get(u.id) ?? [] })),
    sites: sites.map((s) => ({ ...s, skillIds: bySite.get(s.id) ?? [] })),
  }
}

/** Valid, active skill ids of the org from a candidate list (drops anything foreign/inactive). */
async function validSkillIds(orgId: string, skillIds: string[]): Promise<string[]> {
  if (skillIds.length === 0) return []
  const rows = await orgDb(orgId).skill.findMany({ where: { id: { in: skillIds }, isActive: true }, select: { id: true } })
  return rows.map((r) => r.id)
}

/** Replace an employee's skill set. */
export async function setEmployeeSkills(orgId: string, userId: string, skillIds: string[]) {
  const user = await orgDb(orgId).user.findFirst({ where: { id: userId }, select: { id: true } })
  assertFound(user, "Employee")
  const valid = await validSkillIds(orgId, skillIds)
  await orgDb(orgId).employeeSkill.deleteMany({ where: { userId } })
  if (valid.length > 0) {
    await orgDb(orgId).employeeSkill.createMany({ data: valid.map((skillId) => ({ organizationId: orgId, userId, skillId })) })
  }
  return { ok: true, count: valid.length }
}

/** Replace a site's required-skill set. */
export async function setSiteSkillRequirements(orgId: string, serviceLocationId: string, skillIds: string[]) {
  const site = await orgDb(orgId).serviceLocation.findFirst({ where: { id: serviceLocationId }, select: { id: true } })
  assertFound(site, "Site")
  const valid = await validSkillIds(orgId, skillIds)
  await orgDb(orgId).siteSkillRequirement.deleteMany({ where: { serviceLocationId } })
  if (valid.length > 0) {
    await orgDb(orgId).siteSkillRequirement.createMany({ data: valid.map((skillId) => ({ organizationId: orgId, serviceLocationId, skillId })) })
  }
  return { ok: true, count: valid.length }
}
