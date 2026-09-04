import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

type RouteCtx = { params: Promise<{ id: string }> }

async function requireSA() {
  const session = await getSession()
  if (!session?.superAdmin) return null
  return session
}

function extractDomain(website: string | null): string | null {
  if (!website) return null
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content: AnthropicContentBlock[]
}

// POST /api/super-admin/crm/prospects/[id]/outreach
// Generates a personalised outreach email using Claude + web_search
export async function POST(
  _req: NextRequest,
  { params }: RouteCtx
) {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })
  }

  const { id } = await params

  // 1. Fetch prospect with contacts
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: { contacts: { orderBy: { createdAt: "asc" } } },
  })

  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 })
  }

  // 2. Fetch prior emails sent to this prospect's domain
  const domain = extractDomain(prospect.website)
  const priorEmails = domain
    ? await prisma.crmEmail.findMany({
        where: {
          contactEmail: { contains: domain, mode: "insensitive" },
          direction: "sent",
          isDeleted: false,
        },
        orderBy: { sentAt: "asc" },
        select: { subject: true, bodyText: true, sentAt: true, contactEmail: true },
        take: 10,
      })
    : []

  // 3. Build prompt
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const sizeRange =
    prospect.employeeCountMin != null || prospect.employeeCountMax != null
      ? [
          prospect.employeeCountMin != null ? String(prospect.employeeCountMin) : "",
          prospect.employeeCountMax != null ? String(prospect.employeeCountMax) : "",
        ]
          .filter(Boolean)
          .join("–") + " employees"
      : null

  const contactsList = prospect.contacts
    .map(c => `${c.name}${c.title ? ` (${c.title})` : ""}${c.email ? ` <${c.email}>` : ""}`)
    .join("\n")

  const priorEmailsSection =
    priorEmails.length > 0
      ? priorEmails
          .map(
            e =>
              `---\nDate: ${e.sentAt.toLocaleDateString()}\nTo: ${e.contactEmail}\nSubject: ${e.subject}\n\n${e.bodyText?.trim()}`,
          )
          .join("\n\n")
      : "None"

  const prompt = `Today is ${today}.

You are writing a cold outreach email on behalf of Will at Relay (getrelay.software) — a workforce management platform for multi-location service businesses: live GPS tracking, job dispatch, time clock, mileage logging, and customer communication tools built for teams managing 10–200+ employees across multiple sites.

Use the web_search tool to quickly check for any recent news, awards, expansions, or notable developments about this company in the last 6–12 months. If you find something relevant and specific, weave it naturally into the opening or email body. If nothing useful surfaces, skip it gracefully — do not mention the search.

COMPANY PROFILE
---------------
Company: ${prospect.companyName}
Website: ${prospect.website ?? "unknown"}
Industry: ${prospect.industry ?? "unknown"}
Size: ${sizeRange ?? "unknown"}
Locations: ${prospect.locationsCount != null ? String(prospect.locationsCount) : "unknown"}
HQ: ${[prospect.headquartersCity, prospect.headquartersState, prospect.headquartersCountry].filter(Boolean).join(", ") || "unknown"}

What they do:
${prospect.researchSummary ?? "Not available"}

Operational pain points:
${prospect.operationalPainPoints ?? "Not specified"}

Why Relay is a fit:
${prospect.relayFitReasons ?? "Not specified"}

Suggested demo emphasis:
${prospect.suggestedDemoEmphasis ?? "Not specified"}

Suggested outreach angle:
${prospect.suggestedOutreachAngle ?? "Not specified"}

Known contacts:
${contactsList || "None"}

PRIOR EMAILS TO THIS DOMAIN
-----------------------------
${priorEmailsSection}

TASK
----
Write a cold outreach email from Will at Relay to this company. Requirements:

1. Subject line: specific, curiosity-driven, not generic. Reference their industry, a known pain point, or something concrete about their operation. Max 10 words.

2. Email body (HTML):
   - Opening: must NOT be generic ("I hope this finds you well", "I wanted to reach out", etc.). Lead with something specific about their business — their scale, recent news, industry challenge, or operational context.
   - Body: explain concisely why Relay is relevant to their specific situation. Reference their actual pain points or the suggested outreach angle. Do not list product features robotically — frame as business outcomes.
   - CTA: one clear, low-friction ask (e.g., 15-min call, short demo). Keep it conversational.
   - Tone: professional but human. Not salesy. Not corporate. Direct.
   - Length: under 200 words total.
   - Signature: "Will\\nRelay\\ngetrelay.software"
   - Format as clean HTML (p tags, no heavy styling). No placeholder text — every word must be final and send-ready.

3. Plain text version: same content, no HTML tags.

4. Three follow-up subject lines for a drip sequence (subjects only, no bodies):
   - Follow-up 1 (3–5 days later): a different angle or hook
   - Follow-up 2 (7–10 days later): add urgency or social proof angle
   - Follow-up 3 (14+ days later): a breakup / last-touch subject

Respond with ONLY a valid JSON object in this exact shape — no prose, no markdown fences, no explanation:
{
  "subject": "string",
  "bodyHtml": "string",
  "bodyText": "string",
  "followUpSubjects": ["string", "string", "string"]
}`

  // 4. Call Anthropic API with web_search
  let data: AnthropicResponse
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":    "web-search-2025-03-05",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 2048,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[crm-outreach] Anthropic error:", res.status, body.slice(0, 300))
      return NextResponse.json({ error: `Anthropic error: ${res.status}` }, { status: 502 })
    }

    data = (await res.json()) as AnthropicResponse
  } catch (err) {
    console.error("[crm-outreach] fetch failed:", err)
    return NextResponse.json({ error: "Failed to reach Anthropic API" }, { status: 502 })
  }

  // 5. Extract text block from response (after any tool-use rounds)
  const textBlock = data.content.findLast(c => c.type === "text" && c.text)
  const raw = textBlock?.text?.trim() ?? ""

  // Strip markdown fences if Claude wrapped the JSON anyway
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

  let result: {
    subject: string
    bodyHtml: string
    bodyText: string
    followUpSubjects: string[]
  }

  try {
    result = JSON.parse(jsonText)
  } catch (err) {
    console.error("[crm-outreach] Failed to parse Claude response:", jsonText, err)
    return NextResponse.json(
      { error: "Claude returned malformed JSON", raw: jsonText },
      { status: 502 },
    )
  }

  return NextResponse.json(result)
}
