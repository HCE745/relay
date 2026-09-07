import { promises as fs } from "fs"
import path from "path"
import os from "os"

// Local-disk object storage for dev/test ONLY (production selects Vercel Blob;
// see index.ts). The ref returned by put() is the storage key itself.
const ROOT = process.env.CLEANING_UPLOAD_DIR || path.join(os.tmpdir(), "cleaning-uploads")

function safePath(key: string): string {
  const file = path.join(ROOT, key)
  if (!path.resolve(file).startsWith(path.resolve(ROOT))) throw new Error("Invalid storage key")
  return file
}

export class LocalDiskStorage {
  async put(key: string, data: Buffer): Promise<string> {
    const file = safePath(key)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, data)
    return key
  }

  async get(ref: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(safePath(ref))
    } catch {
      return null
    }
  }

  async delete(ref: string): Promise<void> {
    try {
      await fs.unlink(safePath(ref))
    } catch {
      // Already gone — deletion is idempotent.
    }
  }
}
