-- Phase 47: skills & intelligent shift matching. An org catalog of skills,
-- assigned to employees and required by sites. The coverage finder reads these
-- to rank candidates. Deterministic matching; no AI.

CREATE TABLE "cleaning"."Skill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Skill_organizationId_name_key" ON "cleaning"."Skill"("organizationId", "name");
CREATE INDEX "Skill_organizationId_idx" ON "cleaning"."Skill"("organizationId");
ALTER TABLE "cleaning"."Skill" ADD CONSTRAINT "Skill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."EmployeeSkill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeSkill_userId_skillId_key" ON "cleaning"."EmployeeSkill"("userId", "skillId");
CREATE INDEX "EmployeeSkill_organizationId_idx" ON "cleaning"."EmployeeSkill"("organizationId");
CREATE INDEX "EmployeeSkill_skillId_idx" ON "cleaning"."EmployeeSkill"("skillId");
ALTER TABLE "cleaning"."EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cleaning"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "cleaning"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cleaning"."SiteSkillRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceLocationId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteSkillRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SiteSkillRequirement_serviceLocationId_skillId_key" ON "cleaning"."SiteSkillRequirement"("serviceLocationId", "skillId");
CREATE INDEX "SiteSkillRequirement_organizationId_idx" ON "cleaning"."SiteSkillRequirement"("organizationId");
ALTER TABLE "cleaning"."SiteSkillRequirement" ADD CONSTRAINT "SiteSkillRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "cleaning"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SiteSkillRequirement" ADD CONSTRAINT "SiteSkillRequirement_serviceLocationId_fkey" FOREIGN KEY ("serviceLocationId") REFERENCES "cleaning"."ServiceLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning"."SiteSkillRequirement" ADD CONSTRAINT "SiteSkillRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "cleaning"."Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
