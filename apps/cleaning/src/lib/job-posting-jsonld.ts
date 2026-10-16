// schema.org JobPosting structured data for Google for Jobs (Phase 38). Google
// indexes public job pages that carry this JSON-LD — no API, no partnership.
// Required by Google: title, description, datePosted, hiringOrganization,
// jobLocation. We add employmentType/validThrough when we can map them cleanly;
// we never emit a field we cannot make accurate (e.g. a parsed salary), since
// the markup must match the visible page.

const EMPLOYMENT_TYPES: Record<string, string> = {
  "full-time": "FULL_TIME", "fulltime": "FULL_TIME", "full time": "FULL_TIME",
  "part-time": "PART_TIME", "parttime": "PART_TIME", "part time": "PART_TIME",
  "contract": "CONTRACTOR", "contractor": "CONTRACTOR",
  "temporary": "TEMPORARY", "temp": "TEMPORARY", "intern": "INTERN", "internship": "INTERN",
}

export function mapEmploymentType(v: string | null | undefined): string | null {
  if (!v) return null
  return EMPLOYMENT_TYPES[v.trim().toLowerCase()] ?? null
}

export type PostingForJsonLd = {
  title: string
  description: string | null
  employmentType: string | null
  locations: string | null
  createdAt: Date
}

/** Build the JobPosting JSON-LD object. `locations` is free text; we place it as
 *  addressLocality with a US country fallback so jobLocation is always present. */
export function jobPostingJsonLd(posting: PostingForJsonLd, orgName: string): Record<string, unknown> {
  const employmentType = mapEmploymentType(posting.employmentType)
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: posting.title,
    description: posting.description && posting.description.trim() ? posting.description : posting.title,
    datePosted: posting.createdAt.toISOString().slice(0, 10),
    hiringOrganization: { "@type": "Organization", name: orgName },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(posting.locations && posting.locations.trim() ? { addressLocality: posting.locations.trim() } : {}),
        addressCountry: "US",
      },
    },
  }
  if (employmentType) obj.employmentType = employmentType
  return obj
}
