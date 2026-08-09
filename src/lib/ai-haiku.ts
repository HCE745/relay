import "server-only"
import { createHash } from "crypto"
import { prisma } from "./prisma"

const MODEL = "claude-haiku-20240307"

export function hashKey(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16)
}

export async function callHaiku(
  prompt: string,
  opts?: { system?: string; maxTokens?: number; timeoutMs?: number }
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 5000)

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: opts?.maxTokens ?? 256,
        ...(opts?.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json() as { content?: Array<{ text: string }> }
    return data?.content?.[0]?.text ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function getCached(orgId: string, cacheKey: string): Promise<unknown> {
  const entry = await prisma.aiCache.findUnique({
    where: { orgId_cacheKey: { orgId, cacheKey } },
  })
  if (!entry || entry.expiresAt < new Date()) return undefined
  try { return JSON.parse(entry.result) } catch { return undefined }
}

export async function setCache(orgId: string, cacheKey: string, value: unknown, ttlHours = 24): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000)
  await prisma.aiCache.upsert({
    where:  { orgId_cacheKey: { orgId, cacheKey } },
    create: { orgId, cacheKey, result: JSON.stringify(value), expiresAt },
    update: { result: JSON.stringify(value), expiresAt },
  }).catch(() => {/* non-critical */})
}

// ── Feature 1: Duplicate issue detection ─────────────────────────────────────

interface DuplicateResult {
  similarIssueId:    string
  similarIssueTitle: string
  confidence:        number
}

export async function checkDuplicateIssue(
  orgId: string,
  newIssueId: string,
  title: string,
  description: string
): Promise<DuplicateResult | null> {
  const key = `dup:${hashKey(title + description)}`
  const cached = await getCached(orgId, key)
  if (cached !== undefined) return cached as DuplicateResult | null

  const recentIssues = await prisma.issue.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["RESOLVED", "CLOSED"] },
      id: { not: newIssueId },
    },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  if (recentIssues.length < 5) { await setCache(orgId, key, null); return null }

  const list = recentIssues
    .map((i, n) => `${n + 1}. [${i.id}] "${i.title}" — ${(i.description ?? "").slice(0, 80)}`)
    .join("\n")

  const text = await callHaiku(
    `New issue: Title="${title}" Description="${description.slice(0, 200)}"\n\nExisting open issues:\n${list}\n\nIs the new issue a duplicate? If yes with ≥70% confidence, respond with JSON {"dup":true,"id":"existing-id","title":"existing title","conf":0.85}. If not, respond {"dup":false}. Only JSON.`,
    { maxTokens: 128 }
  )
  if (!text) { return null }

  try {
    const json = JSON.parse(text.trim())
    const result = (json.dup && json.conf >= 0.70)
      ? { similarIssueId: json.id, similarIssueTitle: json.title, confidence: json.conf }
      : null
    await setCache(orgId, key, result)
    return result
  } catch {
    return null
  }
}

// ── Feature 2: Title improvement suggestion ───────────────────────────────────

const GENERIC = ["issue", "problem", "fix", "broken", "error", "help", "bug", "thing"]

export function isTitleVague(title: string): boolean {
  const words = title.trim().split(/\s+/)
  if (words.length >= 10) return false
  return words.length < 4 || GENERIC.some(w => title.toLowerCase().includes(w))
}

export async function suggestIssueTitle(
  orgId: string,
  title: string,
  description: string
): Promise<string | null> {
  if (!isTitleVague(title)) return null

  const key = `title:${hashKey(title)}`
  const cached = await getCached(orgId, key)
  if (cached !== undefined) return cached as string | null

  const text = await callHaiku(
    `Rewrite this vague issue title to be specific and descriptive (6-10 words, no quotes): "${title}". Context: "${description.slice(0, 200)}"`,
    { maxTokens: 64 }
  )
  const suggestion = text ? text.trim().replace(/^["']|["']$/g, "") : null
  await setCache(orgId, key, suggestion)
  return suggestion
}
