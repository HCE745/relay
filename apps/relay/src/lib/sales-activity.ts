import { prisma } from "./prisma"

export type ActivityCounter =
  | "emailsSent"
  | "followUpsWorked"
  | "prospectsContacted"
  | "prospectsAdded"
  | "opportunitiesUpdated"
  | "tasksCompleted"
  | "demosLogged"

function todayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// Create a new SalesSession record when a SalesUser logs in.
export async function createSalesSession(salesUserId: string): Promise<void> {
  await prisma.salesSession.create({
    data: { salesUserId },
  })
}

// Close the most recent open session on logout and update daily timeInAppMinutes.
export async function closeSalesSession(salesUserId: string): Promise<void> {
  const now = new Date()
  const session = await prisma.salesSession.findFirst({
    where: { salesUserId, logoutAt: null },
    orderBy: { loginAt: "desc" },
  })
  if (!session) return

  const durationMs = now.getTime() - session.loginAt.getTime()
  const durationMinutes = Math.round(durationMs / 60000)

  await prisma.salesSession.update({
    where: { id: session.id },
    data:  { logoutAt: now, durationMinutes },
  })

  // Credit time to today's activity record (capped at minutes since login)
  const today = todayUTC()
  const clampedMinutes = Math.min(durationMinutes, 16 * 60) // cap at 16h
  if (clampedMinutes > 0) {
    await prisma.salesDailyActivity.upsert({
      where:  { salesUserId_date: { salesUserId, date: today } },
      create: { salesUserId, date: today, timeInAppMinutes: clampedMinutes, lastActivityAt: now },
      update: { timeInAppMinutes: { increment: clampedMinutes }, lastActivityAt: now },
    })
  }
}

// Fire-and-forget: call without await in route handlers.
// Silently updates the active session's lastActivityAt and increments a daily counter.
export function trackActivity(salesUserId: string, counter?: ActivityCounter): void {
  const now = new Date()
  const today = todayUTC()

  Promise.all([
    // Touch the active session
    prisma.salesSession.updateMany({
      where: { salesUserId, logoutAt: null },
      data:  { lastActivityAt: now },
    }),
    // Upsert daily activity row
    prisma.salesDailyActivity.upsert({
      where:  { salesUserId_date: { salesUserId, date: today } },
      create: {
        salesUserId,
        date: today,
        firstActivityAt: now,
        lastActivityAt:  now,
        ...(counter ? { [counter]: 1 } : {}),
      },
      update: {
        lastActivityAt: now,
        ...(counter ? { [counter]: { increment: 1 } } : {}),
      },
    }),
  ]).catch(() => { /* never block the caller */ })
}
