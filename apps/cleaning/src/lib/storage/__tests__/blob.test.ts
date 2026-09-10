import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Vercel Blob SDK so we can assert how the adapter drives it for a
// PRIVATE store — without any real credentials or network.
const put = vi.fn()
const get = vi.fn()
const del = vi.fn()
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a), get: (...a: unknown[]) => get(...a), del: (...a: unknown[]) => del(...a) }))

import { VercelBlobStorage } from "../blob"

function streamOf(bytes: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })
}

describe("VercelBlobStorage (private store)", () => {
  beforeEach(() => {
    put.mockReset()
    get.mockReset()
    del.mockReset()
    process.env.BLOB_READ_WRITE_TOKEN = "test-token"
  })

  it("put uses access:private and returns the pathname ref (never a public URL)", async () => {
    put.mockResolvedValue({ pathname: "jobs/abc-xyz123.jpg", url: "https://blob.example/jobs/abc-xyz123.jpg" })
    const s = new VercelBlobStorage()
    const ref = await s.put("jobs/abc.jpg", Buffer.from("img"), "image/jpeg")

    expect(ref).toBe("jobs/abc-xyz123.jpg")
    expect(ref).not.toContain("http")
    const [key, data, opts] = put.mock.calls[0]
    expect(key).toBe("jobs/abc.jpg")
    expect(data).toBeInstanceOf(Buffer)
    expect(opts).toMatchObject({ access: "private", token: "test-token", contentType: "image/jpeg", addRandomSuffix: true })
  })

  it("get reads private bytes via the SDK (with token), not a bare fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    get.mockResolvedValue({ statusCode: 200, stream: streamOf(Buffer.from("proof-bytes")), headers: new Headers(), blob: {} })
    const s = new VercelBlobStorage()
    const buf = await s.get("jobs/abc-xyz123.jpg")

    expect(buf?.toString()).toBe("proof-bytes")
    expect(get).toHaveBeenCalledWith("jobs/abc-xyz123.jpg", { access: "private", token: "test-token" })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("get returns null when the blob is missing", async () => {
    get.mockResolvedValue(null)
    const s = new VercelBlobStorage()
    expect(await s.get("jobs/missing.jpg")).toBeNull()
  })

  it("delete forwards the pathname ref and the token", async () => {
    del.mockResolvedValue(undefined)
    const s = new VercelBlobStorage()
    await s.delete("jobs/abc-xyz123.jpg")
    expect(del).toHaveBeenCalledWith("jobs/abc-xyz123.jpg", { token: "test-token" })
  })
})
