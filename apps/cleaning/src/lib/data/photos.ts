import { randomUUID } from "crypto"
import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { getStorage, extForContentType } from "../storage"

// Proof-of-service photo upload + retrieval, fully tenant-scoped. Uploader
// identity comes from the session, never the client.

export async function uploadJobPhoto(
  orgId: string,
  jobId: string,
  uploaderId: string,
  opts: {
    data: Buffer
    contentType: string
    sizeBytes: number
    jobChecklistItemId?: string
    issueId?: string
    caption?: string
  },
) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(job, "Job")

  // Association targets must belong to THIS job / org.
  if (opts.jobChecklistItemId) {
    const it = await db.jobChecklistItem.findFirst({ where: { id: opts.jobChecklistItemId, jobId }, select: { id: true } })
    assertFound(it, "Checklist item")
  }
  if (opts.issueId) {
    const iss = await db.issue.findFirst({ where: { id: opts.issueId, jobId }, select: { id: true } })
    assertFound(iss, "Issue")
  }

  const storageKey = `${orgId}/${randomUUID()}.${extForContentType(opts.contentType)}`
  await getStorage().put(storageKey, opts.data, opts.contentType)

  return db.jobPhoto.create({
    data: {
      organizationId: orgId,
      jobId,
      jobChecklistItemId: opts.jobChecklistItemId,
      issueId: opts.issueId,
      storageKey,
      contentType: opts.contentType,
      sizeBytes: opts.sizeBytes,
      uploadedById: uploaderId,
      caption: opts.caption,
    },
  })
}

/** Fetch bytes to serve a photo — org-scoped so IDs can't cross tenants. */
export async function getPhotoForServe(orgId: string, photoId: string) {
  const photo = await orgDb(orgId).jobPhoto.findFirst({
    where: { id: photoId },
    select: { storageKey: true, contentType: true },
  })
  if (!photo) return null
  const bytes = await getStorage().get(photo.storageKey)
  if (!bytes) return null
  return { bytes, contentType: photo.contentType }
}
