import "server-only"
import { prisma } from "./prisma"

// ── Types ─────────────────────────────────────────────────────────────────────

interface IssueForMatching {
  id: string
  title: string
  description: string | null
  category: string
  assetType: string | null
  departmentId: string | null
  organizationId: string
}

interface SOPSection {
  index: number
  heading: string
  body: string
}

interface SOPMatch {
  sopId: string
  confidence: number
  violationNote: string | null
}

// Confidence thresholds per sensitivity level
const SENSITIVITY_THRESHOLDS: Record<string, number> = {
  LOW:    0.50,
  MEDIUM: 0.65,
  HIGH:   0.80,
}

// ── Section parsing ───────────────────────────────────────────────────────────

export function parseSOPSections(content: string): SOPSection[] {
  const sections: SOPSection[] = []
  let index = 0

  // Split by common SOP heading patterns:
  // - Markdown: ## Heading, ### Heading
  // - Numbered: 1. Title, 1.1 Title, Section 1:, SECTION 1 -
  // - ALL CAPS lines of 5+ chars that stand alone
  const lines = content.split("\n")
  let current: { heading: string; lines: string[] } | null = null

  const isHeading = (line: string): boolean => {
    const t = line.trim()
    if (!t) return false
    // Markdown headings
    if (/^#{1,4}\s+\S/.test(t)) return true
    // Numbered section: "1.", "1.1", "1.1.1" followed by text
    if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(t) && t.length < 80) return true
    // "Section N:" or "Section N." patterns
    if (/^(section|SECTION|Step|STEP)\s+\d+/i.test(t) && t.length < 80) return true
    // All-caps line (likely a heading in plain-text SOPs), 5–60 chars
    if (/^[A-Z][A-Z\s\d\-\/]{4,59}$/.test(t) && !/[a-z]/.test(t)) return true
    return false
  }

  const cleanHeading = (line: string): string =>
    line.trim().replace(/^#+\s*/, "").replace(/^\d+(\.\d+)*\.?\s*/, "").trim()

  for (const line of lines) {
    if (isHeading(line)) {
      if (current && current.lines.some(l => l.trim())) {
        sections.push({ index: ++index, heading: current.heading, body: current.lines.join("\n").trim() })
      }
      current = { heading: cleanHeading(line) || line.trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    } else {
      // Content before first heading — treat as intro
      if (line.trim()) {
        if (!current) current = { heading: "Overview", lines: [] }
        current.lines.push(line)
      }
    }
  }
  if (current && current.lines.some(l => l.trim())) {
    sections.push({ index: ++index, heading: current.heading, body: current.lines.join("\n").trim() })
  }

  // Fallback: if fewer than 2 sections found, return a single chunk
  if (sections.length === 0 && content.trim()) {
    return [{ index: 1, heading: "Content", body: content.trim() }]
  }

  return sections
}

// ── Claude helper ─────────────────────────────────────────────────────────────

async function callClaude(prompt: string, maxTokens: number): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content.find(c => c.type === "text")?.text?.trim() ?? null
  } catch {
    return null
  }
}

// ── Metadata pre-filter ───────────────────────────────────────────────────────

function scoreMetadataMatch(
  sop: { category: string | null; assetType: string | null; departmentId: string | null },
  issue: { category: string; assetType: string | null; departmentId: string | null }
): number {
  let score = 0
  // Category match: SOP with null category matches all; exact match is best
  if (!sop.category || sop.category === issue.category) score += 2
  // Asset type match
  if (!sop.assetType || sop.assetType === issue.assetType) score += 1
  // Department match
  if (!sop.departmentId || sop.departmentId === issue.departmentId) score += 1
  return score
}

// ── Main matching function ────────────────────────────────────────────────────

export async function matchSOPToIssue(issue: IssueForMatching): Promise<SOPMatch | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  // Read org sensitivity setting alongside SOPs
  const [org, allSops] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: issue.organizationId },
      select: { sopMatchSensitivity: true },
    }),
    prisma.sOP.findMany({
      where: { organizationId: issue.organizationId, isActive: true },
      select: {
        id: true, title: true, description: true,
        category: true, assetType: true, departmentId: true,
        sections: true,
      },
    }),
  ])

  if (allSops.length === 0) return null

  const threshold = SENSITIVITY_THRESHOLDS[org?.sopMatchSensitivity ?? "MEDIUM"] ?? 0.65

  // ── Step 1: metadata pre-filter ──────────────────────────────────────────────
  // Score each SOP by metadata alignment; require at least 2/4 points to pass.
  // This eliminates SOPs that can't possibly match without an AI call.
  const scored = allSops
    .map(sop => ({
      sop,
      meta: scoreMetadataMatch(
        { category: sop.category, assetType: sop.assetType, departmentId: sop.departmentId },
        { category: issue.category, assetType: issue.assetType, departmentId: issue.departmentId }
      ),
    }))
    .filter(s => s.meta >= 2)                   // must have at least partial alignment
    .sort((a, b) => b.meta - a.meta)             // best metadata match first
    .slice(0, 8)                                  // cap at 8 to bound token use

  if (scored.length === 0) return null

  // ── Step 2: build section-aware SOP list for the AI prompt ───────────────────
  const sopList = scored.map((s, i) => {
    const sections = Array.isArray(s.sop.sections)
      ? (s.sop.sections as unknown as SOPSection[]).slice(0, 5).map(sec => `  § ${sec.index}: ${sec.heading}`).join("\n")
      : ""
    return `${i + 1}. [${s.sop.id}] "${s.sop.title}"${s.sop.description ? ` — ${s.sop.description.slice(0, 80)}` : ""}${s.sop.category ? ` (cat: ${s.sop.category})` : ""}${s.sop.assetType ? ` (asset: ${s.sop.assetType})` : ""}${sections ? `\n${sections}` : ""}`
  }).join("\n")

  const prompt = `You are analyzing a workplace issue report to find the most relevant Standard Operating Procedure (SOP).

Issue title: "${issue.title}"
Issue description: "${(issue.description ?? "").slice(0, 400)}"
Issue category: ${issue.category}
${issue.assetType ? `Asset type: ${issue.assetType}` : ""}

Candidate SOPs (pre-filtered by metadata match):
${sopList}

Find the single best-matching SOP if genuinely relevant. Do NOT match if the issue is completely unrelated to any SOP.

When there is a possible SOP violation, reference the specific section (e.g. "Possible failure to follow § 3 Safety Precautions — lockout/tagout protocol not applied before servicing"). If section headings are not listed, write the violation in general terms.

Respond ONLY with valid JSON — no markdown:
{"sopId":"<exact id from list or null>","confidence":<0.0-1.0>,"violationNote":"<specific section-aware violation concern or null>"}

Rules:
- sopId: exact ID from above, or null if no good match
- confidence >= ${threshold}: a match; below ${threshold}: return null for sopId
- violationNote: only when issue suggests SOP was not followed; reference section if available; null otherwise
- Never match on superficial word overlap — require genuine procedural or equipment relevance
- If no SOP is relevant: {"sopId":null,"confidence":0,"violationNote":null}`

  const text = await callClaude(prompt, 200)
  if (!text) return null

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as {
      sopId?: string | null
      confidence?: number
      violationNote?: string | null
    }

    if (!parsed.sopId || (parsed.confidence ?? 0) < threshold) return null

    const valid = scored.find(s => s.sop.id === parsed.sopId)
    if (!valid) return null

    return {
      sopId: parsed.sopId,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
      violationNote: parsed.violationNote ?? null,
    }
  } catch {
    return null
  }
}

// ── SOP improvement generation ────────────────────────────────────────────────

export async function generateSOPImprovement(sopId: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const sop = await prisma.sOP.findUnique({
    where: { id: sopId },
    select: {
      title: true,
      content: true,
      sections: true,
      issues: {
        where: { status: "RESOLVED" },
        select: {
          title: true,
          rootCause: true,
          resolvedMethod: true,
          sopViolation: true,
          sopComplianceOutcome: true,
        },
        orderBy: { resolvedAt: "desc" },
        take: 30,
      },
      _count: { select: { issues: true } },
    },
  })

  if (!sop || sop._count.issues < 10) return

  // Build issue summary with compliance outcomes
  const issueList = sop.issues.map((i, idx) => {
    const outcome = i.sopComplianceOutcome
      ? ` [${i.sopComplianceOutcome.replace("_", " ")}]`
      : i.sopViolation ? " [SOP NOT followed]" : ""
    return `${idx + 1}. "${i.title}"${i.rootCause ? ` — Cause: ${i.rootCause.slice(0, 80)}` : ""}${i.resolvedMethod ? ` — Fixed by: ${i.resolvedMethod.slice(0, 80)}` : ""}${outcome}`
  }).join("\n")

  // Build section summary for context
  const sections = Array.isArray(sop.sections) ? (sop.sections as unknown as SOPSection[]) : []
  const sectionSummary = sections.length > 0
    ? `\nSOP Sections:\n${sections.map(s => `  § ${s.index}: ${s.heading}`).join("\n")}`
    : ""

  const nonComplianceCount = sop.issues.filter(i => i.sopComplianceOutcome === "SOP_NON_COMPLIANCE" || i.sopViolation).length
  const deficiencyCount = sop.issues.filter(i => i.sopComplianceOutcome === "SOP_DEFICIENCY").length

  const prompt = `You are a safety and operations expert reviewing an SOP linked to multiple incidents.

SOP Title: "${sop.title}"${sectionSummary}

SOP Content (excerpt):
${sop.content.slice(0, 1500)}

Incident summary: ${sop._count.issues} total incidents — ${nonComplianceCount} non-compliance cases, ${deficiencyCount} deficiency cases.
Recent resolved incidents:
${issueList || "No resolved incidents with detailed data."}

Generate a concise improvement suggestion (2-4 sentences) that:
1. Identifies the recurring pattern across these incidents
2. Recommends a specific, actionable addition or change to the SOP
3. References specific sections by number where relevant (e.g., "Add to § 3 Safety Precautions: …")

Start with "This SOP has been linked to ${sop._count.issues} incidents." then give the improvement.
Plain prose only — no markdown headers or bullet points. Under 200 words. Be specific.`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim()
    if (!text) return

    await prisma.sOP.update({
      where: { id: sopId },
      data: {
        aiImprovementSuggestion:  text,
        aiImprovementGeneratedAt: new Date(),
      },
    })
  } catch {
    // Non-fatal
  }
}
