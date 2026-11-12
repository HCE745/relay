import "server-only"
import { prisma } from "@/lib/prisma"

// Activity types that constitute a real outreach interaction.
// All of these confirm the rep actually attempted contact.
export const OUTREACH_ACTIVITY_TYPES = new Set([
  "EMAIL_SENT",
  "CALL_CONNECTED",
  "CALL_VOICEMAIL",
  "CALL_NO_ANSWER",
  "MEETING_HELD",
  "MEETING",         // front-end value alias
  "LINKEDIN_MESSAGE",
  "LINKEDIN",        // front-end value alias
])

/**
 * Called after a confirmed outreach interaction for a CRM prospect.
 *
 * Marks every ProspectResearchResult row that is linked to `prospectId`
 * and owned by this user as done (if not already). Then checks whether
 * each affected list is now fully complete and auto-completes it.
 *
 * This runs server-side, after the email/activity is persisted, so only
 * confirmed successful interactions trigger completion.
 */
export async function markOutreachDone(opts: {
  prospectId:   string
  salesUserId:  string | null
  superAdminId: string | null
}): Promise<void> {
  const { prospectId, salesUserId, superAdminId } = opts
  if (!prospectId || (!salesUserId && !superAdminId)) return

  const now = new Date()

  // Find undone results for this prospect in this rep's own lists
  const results = await prisma.prospectResearchResult.findMany({
    where: {
      prospectId,
      isDone: false,
      list: salesUserId
        ? { salesUserId }
        : { superAdminId: superAdminId! },
    },
    select: { id: true, listId: true },
  })

  if (results.length === 0) return

  // Mark them done
  await prisma.prospectResearchResult.updateMany({
    where: { id: { in: results.map(r => r.id) } },
    data:  { isDone: true, doneAt: now },
  })

  // Check each affected list for auto-completion
  const affectedListIds = [...new Set(results.map(r => r.listId))]
  for (const listId of affectedListIds) {
    const [total, done] = await Promise.all([
      prisma.prospectResearchResult.count({ where: { listId } }),
      prisma.prospectResearchResult.count({ where: { listId, isDone: true } }),
    ])
    if (total > 0 && total === done) {
      await prisma.prospectResearchList.updateMany({
        where: { id: listId, status: "active" },
        data:  { status: "completed", completedAt: now },
      })
    }
  }
}
