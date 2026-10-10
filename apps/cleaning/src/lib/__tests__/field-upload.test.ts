import { describe, it, expect, vi } from "vitest"
import { uploadPhoto } from "../field-upload"

const file = new File([new Uint8Array([1, 2, 3])], "proof.jpg", { type: "image/jpeg" })
const okRes = () => ({ ok: true, status: 201, json: async () => ({ id: "p1" }) }) as unknown as Response
const errRes = (status: number, error?: string) => ({ ok: false, status, json: async () => (error ? { error } : {}) }) as unknown as Response

describe("uploadPhoto", () => {
  it("returns ok on a 2xx (single call)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes())
    const r = await uploadPhoto("/u", file, { jobChecklistItemId: "i1" }, { fetchImpl })
    expect(r).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("sends the file and fields as multipart", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes())
    await uploadPhoto("/u", file, { jobChecklistItemId: "i1" }, { fetchImpl })
    const [, init] = fetchImpl.mock.calls[0]
    const body = init.body as FormData
    expect(body.get("jobChecklistItemId")).toBe("i1")
    expect(body.get("file")).toBeInstanceOf(File)
    expect(init.method).toBe("POST")
  })

  it("surfaces a 4xx error message and does NOT retry", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errRes(413, "Image exceeds 10 MB"))
    const r = await uploadPhoto("/u", file, {}, { fetchImpl, retries: 2 })
    expect(r).toEqual({ ok: false, error: "Image exceeds 10 MB" })
    expect(fetchImpl).toHaveBeenCalledTimes(1) // 4xx is deterministic
  })

  it("retries a thrown network error, then succeeds", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(okRes())
    const r = await uploadPhoto("/u", file, {}, { fetchImpl, retries: 1 })
    expect(r).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("returns a failure (not throw) when retries are exhausted", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"))
    const r = await uploadPhoto("/u", file, {}, { fetchImpl, retries: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/connection/i)
    expect(fetchImpl).toHaveBeenCalledTimes(2) // initial + 1 retry
  })

  it("retries a 5xx then surfaces failure if it persists", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errRes(503))
    const r = await uploadPhoto("/u", file, {}, { fetchImpl, retries: 1 })
    expect(r.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
