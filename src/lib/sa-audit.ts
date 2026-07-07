import { Prisma } from "@/generated/prisma/client"
import { prisma } from "./prisma"

export type AuditAction =
  | "UPDATE_ORG"
  | "SUSPEND_ORG"
  | "REACTIVATE_ORG"
  | "RESET_ONBOARDING"
  | "UPDATE_TRIAL"
  | "UPDATE_PRICING"
  | "ADD_NOTE"
  | "CHANGE_USER_ROLE"
  | "CHANGE_USER_STATUS"
  // Billing Credits Engine
  | "CREATE_BILLING_CREDIT"
  | "ACTIVATE_BILLING_CREDIT"
  | "UPDATE_BILLING_CREDIT"
  | "COMPLETE_BILLING_CREDIT"
  | "CANCEL_BILLING_CREDIT"
  // Referrals
  | "CREATE_REFERRAL"
  | "UPDATE_REFERRAL"

export async function logSAAction({
  superAdminId,
  superAdminName,
  action,
  orgId,
  orgName,
  targetType,
  targetId,
  targetName,
  before,
  after,
}: {
  superAdminId: string
  superAdminName: string
  action: AuditAction
  orgId: string
  orgName: string
  targetType: "organization" | "user"
  targetId: string
  targetName: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}) {
  await prisma.superAdminAuditLog.create({
    data: {
      superAdminId,
      superAdminName,
      action,
      orgId,
      orgName,
      targetType,
      targetId,
      targetName,
      before: (before ?? Prisma.JsonNull) as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
      after:  (after  ?? Prisma.JsonNull) as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
    },
  })
}
