import { put as blobPut, get as blobGet, del as blobDel } from "@vercel/blob"

// Durable object storage via Vercel Blob, backed by a PRIVATE store. The ref
// returned by put() is the blob's pathname (unguessable + random-suffixed).
// Private blobs are NOT publicly fetchable — bytes are read server-side with the
// read-write token via the SDK and streamed through the tenant-scoped
// /api/photos/[id] route. The pathname/URL is never handed to clients.
export class VercelBlobStorage {
  private token: string

  constructor() {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")
    this.token = token
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const res = await blobPut(key, data, {
      access: "private",
      token: this.token,
      contentType,
      addRandomSuffix: true, // unguessable keys; no tenant enumeration
    })
    // Store the pathname (not the URL): get()/del() both accept it, and it keeps
    // no publicly-resolvable URL at rest in our database.
    return res.pathname
  }

  async get(ref: string): Promise<Buffer | null> {
    // Private blobs require an authenticated read; a bare fetch(url) would 403.
    const res = await blobGet(ref, { access: "private", token: this.token })
    if (!res || res.stream === null) return null // not found (or 304 — never requested)
    return Buffer.from(await new Response(res.stream).arrayBuffer())
  }

  async delete(ref: string): Promise<void> {
    await blobDel(ref, { token: this.token })
  }
}
