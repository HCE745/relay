import { describe, it, expect } from "vitest"
import { validatePhoto, extForContentType } from "../index"

describe("validatePhoto", () => {
  it("accepts a normal jpeg", () => {
    expect(validatePhoto("image/jpeg", 500_000)).toBeNull()
  })
  it("rejects non-image types", () => {
    expect(validatePhoto("text/plain", 100)).not.toBeNull()
    expect(validatePhoto("application/pdf", 100)).not.toBeNull()
  })
  it("rejects empty and oversize files", () => {
    expect(validatePhoto("image/png", 0)).not.toBeNull()
    expect(validatePhoto("image/png", 20 * 1024 * 1024)).not.toBeNull()
  })
})

describe("extForContentType", () => {
  it("maps common image types", () => {
    expect(extForContentType("image/jpeg")).toBe("jpg")
    expect(extForContentType("image/png")).toBe("png")
    expect(extForContentType("image/webp")).toBe("webp")
  })
})
