import { LocalDiskStorage } from "./local"
import { VercelBlobStorage } from "./blob"

// Storage abstraction so the rest of Cleaning never depends on a concrete
// backend. `put` returns an opaque REF that later get/delete calls interpret
// (for local: the key; for Vercel Blob: the blob URL). Callers persist the ref.
//
// Delivery stays authenticated/tenant-scoped: /api/photos/[id] looks the photo
// up org-scoped, then streams bytes via storage.get(ref). Blob URLs (unguessable
// + random-suffixed) are never exposed to clients.

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<string>
  get(ref: string): Promise<Buffer | null>
  delete(ref: string): Promise<void>
}

export type StorageKind = "local" | "blob"

/**
 * Decide which storage backend to use — a pure function so the rules are
 * testable without real credentials. Production MUST use durable storage; it
 * never silently falls back to ephemeral local disk.
 */
export function chooseStorageKind(env: {
  nodeEnv?: string
  blobToken?: string
  override?: string
}): StorageKind {
  if (env.override === "local") return "local"
  if (env.override === "blob") {
    if (!env.blobToken) throw new Error("CLEANING_STORAGE=blob but BLOB_READ_WRITE_TOKEN is not set")
    return "blob"
  }
  if (env.blobToken) return "blob"
  if (env.nodeEnv === "production") {
    throw new Error(
      "Durable storage is not configured. Set BLOB_READ_WRITE_TOKEN — production must not use ephemeral local disk.",
    )
  }
  return "local"
}

let cached: Storage | null = null

export function getStorage(): Storage {
  if (cached) return cached
  const kind = chooseStorageKind({
    nodeEnv: process.env.NODE_ENV,
    blobToken: process.env.BLOB_READ_WRITE_TOKEN,
    override: process.env.CLEANING_STORAGE,
  })
  cached = kind === "blob" ? new VercelBlobStorage() : new LocalDiskStorage()
  return cached
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

export function validatePhoto(contentType: string, sizeBytes: number): string | null {
  if (!ALLOWED.has(contentType)) return "Unsupported image type"
  if (sizeBytes <= 0) return "Empty file"
  if (sizeBytes > MAX_BYTES) return "Image exceeds 10 MB"
  return null
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

export function extForContentType(contentType: string): string {
  return EXT[contentType] ?? "bin"
}
