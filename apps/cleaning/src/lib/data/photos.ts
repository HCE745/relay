import { randomUUID } from "crypto"
import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { getStorage, extForContentType } from "../storage"

// Proof-of-service + inspection photo upload/retrieval, fully tenant-scoped.
// Uploader identity comes from the session, never the client.

type PhotoData = { data: Buffer; contentType: string; sizeBytes: number; caption?: string }
type Links = {
  jobId?: string | null
  jobChecklistItemId?: string
  issueId?: string
  inspectionId?: string
  inspectionItemResultId?: string
}

// Upload the object FIRST, then create the row. If the row fails, clean up the
// orphaned object so an upload failure never leaves a broken DB record and a DB
// failure never leaves a dangling blob.
async function storeAndCreate(orgId: string, uploaderId: string, photo: PhotoData, links: Links) {
  // Demo orgs never write to Blob — they use the pre-seeded placeholder.
  const { isDemoOrg } = await import("../demo/provision")
  if (await isDemoOrg(orgId)) {
    const { ForbiddenActionError } = await import("./errors")
    throw new ForbiddenActionError("Photo uploads are disabled in the demo")
  }
  const key = `${orgId}/${randomUUID()}.${extForContentType(photo.contentType)}`
  const ref = await getStorage().put(key, photo.data, photo.contentType)
  try {
    return await orgDb(orgId).jobPhoto.create({
      data: {
        organizationId: orgId,
        jobId: links.jobId ?? null,
        jobChecklistItemId: links.jobChecklistItemId,
        issueId: links.issueId,
        inspectionId: links.inspectionId,
        inspectionItemResultId: links.inspectionItemResultId,
        storageKey: ref,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        uploadedById: uploaderId,
        caption: photo.caption,
      },
    })
  } catch (e) {
    await getStorage().delete(ref).catch(() => {})
    throw e
  }
}

export async function uploadJobPhoto(
  orgId: string,
  jobId: string,
  uploaderId: string,
  opts: PhotoData & { jobChecklistItemId?: string; issueId?: string },
) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(job, "Job")
  if (opts.jobChecklistItemId) {
    const it = await db.jobChecklistItem.findFirst({ where: { id: opts.jobChecklistItemId, jobId }, select: { id: true } })
    assertFound(it, "Checklist item")
  }
  if (opts.issueId) {
    const iss = await db.issue.findFirst({ where: { id: opts.issueId, jobId }, select: { id: true } })
    assertFound(iss, "Issue")
  }
  return storeAndCreate(orgId, uploaderId, opts, {
    jobId,
    jobChecklistItemId: opts.jobChecklistItemId,
    issueId: opts.issueId,
  })
}

export async function uploadInspectionPhoto(
  orgId: string,
  inspectionId: string,
  uploaderId: string,
  opts: PhotoData & { inspectionItemResultId?: string },
) {
  const db = orgDb(orgId)
  const insp = await db.inspection.findFirst({ where: { id: inspectionId }, select: { id: true, jobId: true } })
  assertFound(insp, "Inspection")
  if (opts.inspectionItemResultId) {
    const r = await db.inspectionItemResult.findFirst({
      where: { id: opts.inspectionItemResultId, inspectionId },
      select: { id: true },
    })
    assertFound(r, "Inspection item")
  }
  return storeAndCreate(orgId, uploaderId, opts, {
    jobId: insp!.jobId,
    inspectionId,
    inspectionItemResultId: opts.inspectionItemResultId,
  })
}

// Demo orgs never write to Blob — their proof photos use this placeholder.
export const DEMO_PLACEHOLDER_KEY = "demo-placeholder"
const PLACEHOLDER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e2e8f0"/><g fill="#94a3b8"><circle cx="200" cy="120" r="44"/><rect x="110" y="190" width="180" height="70" rx="10"/></g><text x="200" y="285" text-anchor="middle" font-family="system-ui" font-size="14" fill="#64748b">Demo proof photo</text></svg>`,
)

export async function getPhotoForServe(orgId: string, photoId: string) {
  const photo = await orgDb(orgId).jobPhoto.findFirst({
    where: { id: photoId },
    select: { storageKey: true, contentType: true },
  })
  if (!photo) return null
  if (photo.storageKey === DEMO_PLACEHOLDER_KEY) return { bytes: PLACEHOLDER_SVG, contentType: "image/svg+xml" }
  const bytes = await getStorage().get(photo.storageKey)
  if (!bytes) return null
  return { bytes, contentType: photo.contentType }
}

/** Delete a photo: remove the row (source of truth), then best-effort the object. */
export async function deleteJobPhoto(orgId: string, photoId: string): Promise<boolean> {
  const db = orgDb(orgId)
  const photo = await db.jobPhoto.findFirst({ where: { id: photoId }, select: { id: true, storageKey: true } })
  if (!photo) return false
  await db.jobPhoto.deleteMany({ where: { id: photoId } })
  await getStorage().delete(photo.storageKey).catch(() => {})
  return true
}
