"use server"

import { prisma } from "./prisma"

export async function setLifecycle(
  organizationId: string,
  status: string,
  actorName?: string,
  previousStatus?: string,
) {
  await prisma.organization.update({
    where: { id: organizationId },
    data:  { lifecycleStatus: status },
  })

  await prisma.crmActivity.create({
    data: {
      organizationId,
      eventType:       "lifecycle_changed",
      description:     previousStatus
        ? `Lifecycle status changed from "${previousStatus}" to "${status}"`
        : `Lifecycle status set to "${status}"`,
      createdBySAName: actorName ?? null,
    },
  })
}
