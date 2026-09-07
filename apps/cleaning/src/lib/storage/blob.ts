import { put as blobPut, del as blobDel } from "@vercel/blob"

// Durable object storage via Vercel Blob. The ref returned by put() is the blob
// URL (unguessable + random-suffixed). We never hand this URL to clients — bytes
// are streamed through the tenant-scoped /api/photos/[id] route.
export class VercelBlobStorage {
  private token: string

  constructor() {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")
    this.token = token
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const res = await blobPut(key, data, {
      access: "public",
      token: this.token,
      contentType,
      addRandomSuffix: true, // unguessable keys; no tenant enumeration
    })
    return res.url
  }

  async get(ref: string): Promise<Buffer | null> {
    const res = await fetch(ref)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }

  async delete(ref: string): Promise<void> {
    await blobDel(ref, { token: this.token })
  }
}
