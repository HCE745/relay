import { promises as fs } from "fs"
import path from "path"
import os from "os"

// Local-disk object storage for dev/test. Files live under CLEANING_UPLOAD_DIR
// (default: OS temp dir). NOTE: serverless filesystems are ephemeral — see
// src/lib/storage/index.ts for the production (Vercel Blob) path.
const ROOT = process.env.CLEANING_UPLOAD_DIR || path.join(os.tmpdir(), "cleaning-uploads")

export class LocalDiskStorage {
  async put(key: string, data: Buffer): Promise<void> {
    const file = path.join(ROOT, key)
    // Guard against path traversal escaping ROOT.
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) throw new Error("Invalid storage key")
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, data)
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(ROOT, key))
    } catch {
      return null
    }
  }
}
