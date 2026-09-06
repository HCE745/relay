import { LocalDiskStorage } from "./local"

// Storage abstraction so the rest of Cleaning never depends on a concrete
// backend. Today it is local disk. For production, implement a Vercel Blob
// adapter behind this same interface and select it when BLOB_READ_WRITE_TOKEN
// is present — no call-site changes required.
//
// PRODUCTION CONFIG STILL REQUIRED: object storage credentials
// (e.g. BLOB_READ_WRITE_TOKEN) + a VercelBlobStorage implementing Storage.
// Local disk is NOT durable on serverless and is intended for dev/test only.

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer | null>
}

let cached: Storage | null = null

export function getStorage(): Storage {
  if (cached) return cached
  // if (process.env.BLOB_READ_WRITE_TOKEN) cached = new VercelBlobStorage()  // TODO Phase-3+ prod
  cached = new LocalDiskStorage()
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
