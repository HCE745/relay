"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"
import { isPlatformAdmin } from "@/lib/platform-admin"
import { updateFeedbackStatusAny, FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/data/feedback"

// Platform-admin only: software feedback is CleanWare product data, managed
// across orgs. A customer org role never reaches this.
export async function setFeedbackStatus(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!isPlatformAdmin(session)) return
  const id = String(formData.get("id") || "")
  const status = String(formData.get("status") || "") as FeedbackStatus
  if (!id || !FEEDBACK_STATUSES.includes(status)) return
  const note = String(formData.get("resolutionNote") || "").trim() || undefined
  await updateFeedbackStatusAny(session!.userId, id, status, note)
  revalidatePath(`/feedback/${id}`)
  revalidatePath("/feedback")
}
