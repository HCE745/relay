import { describe, it, expect } from "vitest"
import { jobPostingJsonLd, mapEmploymentType } from "../job-posting-jsonld"

describe("mapEmploymentType", () => {
  it("maps known labels to Google enums, else null", () => {
    expect(mapEmploymentType("Full-time")).toBe("FULL_TIME")
    expect(mapEmploymentType("part time")).toBe("PART_TIME")
    expect(mapEmploymentType("Contractor")).toBe("CONTRACTOR")
    expect(mapEmploymentType("seasonal gig")).toBeNull()
    expect(mapEmploymentType(null)).toBeNull()
  })
})

describe("jobPostingJsonLd", () => {
  const posting = { title: "Night Cleaner", description: "Clean offices after hours.", employmentType: "Full-time", locations: "Detroit, MI", createdAt: new Date("2026-10-01T12:00:00Z") }

  it("includes all Google-required fields", () => {
    const o = jobPostingJsonLd(posting, "Sparkle Co") as Record<string, unknown>
    expect(o["@type"]).toBe("JobPosting")
    expect(o.title).toBe("Night Cleaner")
    expect(o.description).toBe("Clean offices after hours.")
    expect(o.datePosted).toBe("2026-10-01")
    expect((o.hiringOrganization as Record<string, unknown>).name).toBe("Sparkle Co")
    const addr = (o.jobLocation as Record<string, Record<string, string>>).address
    expect(addr.addressLocality).toBe("Detroit, MI")
    expect(addr.addressCountry).toBe("US")
    expect(o.employmentType).toBe("FULL_TIME")
  })

  it("falls back to the title when there is no description, and omits unmappable employmentType", () => {
    const o = jobPostingJsonLd({ ...posting, description: "", employmentType: "gig" }, "Sparkle Co")
    expect(o.description).toBe("Night Cleaner")
    expect(o.employmentType).toBeUndefined()
  })

  it("still emits jobLocation (country) when no locations are given", () => {
    const o = jobPostingJsonLd({ ...posting, locations: null }, "Sparkle Co") as Record<string, unknown>
    const addr = (o.jobLocation as Record<string, Record<string, string>>).address
    expect(addr.addressCountry).toBe("US")
    expect(addr.addressLocality).toBeUndefined()
  })
})
