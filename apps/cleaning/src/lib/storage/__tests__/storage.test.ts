import { describe, it, expect } from "vitest"
import { chooseStorageKind } from "../index"
import { LocalDiskStorage } from "../local"

describe("chooseStorageKind", () => {
  it("dev without a token uses local", () => {
    expect(chooseStorageKind({ nodeEnv: "development" })).toBe("local")
  })
  it("PRODUCTION without a token throws (never silent local fallback)", () => {
    expect(() => chooseStorageKind({ nodeEnv: "production" })).toThrow(/Durable storage/)
  })
  it("production with a blob token uses blob", () => {
    expect(chooseStorageKind({ nodeEnv: "production", blobToken: "tok" })).toBe("blob")
  })
  it("a blob token selects blob even in dev", () => {
    expect(chooseStorageKind({ nodeEnv: "development", blobToken: "tok" })).toBe("blob")
  })
  it("override=local forces local", () => {
    expect(chooseStorageKind({ nodeEnv: "production", blobToken: "tok", override: "local" })).toBe("local")
  })
  it("override=blob without a token throws", () => {
    expect(() => chooseStorageKind({ nodeEnv: "development", override: "blob" })).toThrow(/BLOB_READ_WRITE_TOKEN/)
  })
})

describe("LocalDiskStorage round-trip", () => {
  it("put → get → delete", async () => {
    const s = new LocalDiskStorage()
    const key = `test-storage/${Date.now()}-${Math.floor(Math.random() * 1e6)}.bin`
    const data = Buffer.from("hello proof")
    const ref = await s.put(key, data)
    expect(ref).toBe(key)
    const got = await s.get(ref)
    expect(got?.toString()).toBe("hello proof")
    await s.delete(ref)
    expect(await s.get(ref)).toBeNull()
  })
  it("get on a missing key returns null", async () => {
    const s = new LocalDiskStorage()
    expect(await s.get("nope/missing.bin")).toBeNull()
  })
})
