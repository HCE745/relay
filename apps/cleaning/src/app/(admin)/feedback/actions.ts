"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { canManageAccounts } from "@/lib/rbac"
import { updateFeedbackStatus, FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/data/feedback"

export async function setFeedbackStatus(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session || !canManageAccounts(session.role)) return
  const id = String(formData.get("id") || "")
  const status = String(formData.get("status") || "") as FeedbackStatus
  if (!id || !FEEDBACK_STATUSES.includes(status)) return
  const note = String(formData.get("resolutionNote") || "").trim() || undefined
  await updateFeedbackStatus(session.organizationId, session.userId, id, status, note)
  revalidatePath(`/feedback/${id}`)
  revalidatePath("/feedback")
}
