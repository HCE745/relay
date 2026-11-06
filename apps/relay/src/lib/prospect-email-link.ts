/**
 * Auto-link a CrmEmail to its Prospect (Company) record.
 *
 * Priority:
 *   1. demoCallId → DemoCall.prospectId (most reliable)
 *   2. contactEmail → ProspectContact.email → Prospect
 *   3. contactEmail domain → Prospect.website (domain match)
 *   4. Create a stub Prospect if domain is non-generic and assignedToId is known
 *
 * Returns the prospectId that was linked (or null if none found/created).
 */

import { prisma } from "./prisma"

const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "protonmail.com", "live.com", "msn.com", "ymail.com",
  "me.com", "mac.com", "inbox.com", "mail.com", "zoho.com",
])

function extractDomain(email: string): string | null {
  const at = email.indexOf("@")
  if (at < 0) return null
  return email.slice(at + 1).toLowerCase().trim()
}

function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain)
}

/** Derive a human-readable company name from a domain, e.g. midwestprecision.com → Midwest Precision */
function nameFromDomain(domain: string): string {
  const base = domain.split(".")[0] ?? domain
  return base
    .replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export async function linkEmailToProspect(params: {
  crmEmailId:    string
  contactEmail:  string
  demoCallId?:   string | null
  salesUserId?:  string | null
  createIfMissing?: boolean  // default true
}): Promise<string | null> {
  const { crmEmailId, contactEmail, demoCallId, salesUserId, createIfMissing = true } = params

  const normalizedEmail = contactEmail.toLowerCase().trim()
  const domain = extractDomain(normalizedEmail)

  let prospectId: string | null = null
  let contactId:  string | null = null

  // 1. Via demoCallId → DemoCall.prospectId
  if (demoCallId) {
    const dc = await prisma.demoCall.findUnique({
      where:  { id: demoCallId },
      select: { prospectId: true },
    })
    if (dc?.prospectId) {
      prospectId = dc.prospectId
    }
  }

  // 2. Via ProspectContact.email
  if (!prospectId) {
    const contact = await prisma.prospectContact.findFirst({
      where:   { email: { equals: normalizedEmail, mode: "insensitive" } },
      select:  { id: true, prospectId: true },
      orderBy: { createdAt: "asc" },
    })
    if (contact) {
      prospectId = contact.prospectId
      contactId  = contact.id
    }
  }

  // 3. Via domain → Prospect.website
  if (!prospectId && domain && !isGenericDomain(domain)) {
    const p = await prisma.prospect.findFirst({
      where: {
        OR: [
          { website: { contains: domain, mode: "insensitive" } },
          { website: { contains: domain.replace(/^www\./, ""), mode: "insensitive" } },
        ],
      },
      select:  { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (p) prospectId = p.id
  }

  // 4. Create stub Prospect if non-generic domain and rep is known
  if (!prospectId && domain && !isGenericDomain(domain) && createIfMissing && salesUserId) {
    const companyName = nameFromDomain(domain)
    const prospect = await prisma.prospect.create({
      data: {
        companyName,
        website:         domain,
        source:          "ai_research",
        currentCrmStatus: "contacted",
        assignedToId:    salesUserId,
      },
      select: { id: true },
    })
    prospectId = prospect.id
  }

  // Update CrmEmail with prospectId (and contactId if found)
  if (prospectId) {
    await prisma.crmEmail.update({
      where: { id: crmEmailId },
      data:  {
        prospectId,
        ...(contactId ? { contactId } : {}),
      },
    })
  }

  return prospectId
}
