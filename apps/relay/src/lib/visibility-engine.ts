type TextBlock   = { type: "text";        text: string }
type ToolUseBlock = { type: "tool_use";   id: string; name: string; input: unknown }
type ToolResBlock = { type: "tool_result"; tool_use_id: string; content: { url?: string; title?: string }[] }
type Block = TextBlock | ToolUseBlock | ToolResBlock | { type: string }

interface AnthropicMsg {
  content: Block[]
  usage: { input_tokens: number; output_tokens: number }
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001"
const BASE = "https://api.anthropic.com/v1/messages"

function headers(webSearch = false) {
  const h: Record<string, string> = {
    "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  }
  if (webSearch) h["anthropic-beta"] = "web-search-2025-03-05"
  return h
}

export interface CheckResult {
  text:         string
  sources:      string[]
  searchCount:  number
  inputTokens:  number
  outputTokens: number
}

export async function callWithWebSearch(prompt: string, model = DEFAULT_MODEL): Promise<CheckResult> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as AnthropicMsg

  const text = (data.content ?? [])
    .filter((b): b is TextBlock => b.type === "text")
    .map(b => b.text)
    .join("\n")
    .trim()

  const sources: string[] = []
  let searchCount = 0
  for (const block of data.content ?? []) {
    if (block.type === "tool_use" && (block as ToolUseBlock).name === "web_search") {
      searchCount++
    }
    if (block.type === "tool_result") {
      const content = (block as ToolResBlock).content
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.url) sources.push(item.url)
        }
      }
    }
  }

  return {
    text,
    sources:      [...new Set(sources)],
    searchCount,
    inputTokens:  data.usage?.input_tokens  ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

export async function callForAnalysis(prompt: string, model = DEFAULT_MODEL): Promise<string> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(false),
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Anthropic ${res.status}`)

  const data = await res.json() as AnthropicMsg
  return (data.content ?? [])
    .filter((b): b is TextBlock => b.type === "text")
    .map(b => b.text)
    .join("\n")
    .trim()
}

// cost per token for claude-haiku-4-5 (as specified)
const INPUT_COST_PER_M  = 3.00
const OUTPUT_COST_PER_M = 15.00
const SEARCH_COST       = 0.01

export function computeCheckCost(inputTokens: number, outputTokens: number, searchCount: number): number {
  return (inputTokens  / 1_000_000 * INPUT_COST_PER_M)
       + (outputTokens / 1_000_000 * OUTPUT_COST_PER_M)
       + (searchCount  * SEARCH_COST)
}

const RELAY_DOMAINS = ["getrelay.software", "getrelay.app", "relay.software"]

export function parseRelayMention(text: string, sources: string[]): {
  relayMentioned:  boolean
  mentionOrder:    number | null
  prominenceScore: string
  citationToRelay: boolean
  relayCitedUrls:  string[]
} {
  const lower = text.toLowerCase()
  const relayMentioned = lower.includes("relay") || lower.includes("getrelay")

  // mentionOrder = 1-based paragraph index of first relay mention
  let mentionOrder: number | null = null
  if (relayMentioned) {
    const paras = text.split(/\n+/)
    for (let j = 0; j < paras.length; j++) {
      const pl = paras[j].toLowerCase()
      if (pl.includes("relay") || pl.includes("getrelay")) {
        mentionOrder = j + 1
        break
      }
    }
  }

  // prominenceScore
  let prominenceScore = "none"
  if (relayMentioned) {
    const occurrences = (lower.match(/\brelay\b|\bgetrelay\b/g) ?? []).length
    if (mentionOrder !== null && mentionOrder <= 2 || occurrences >= 3) {
      prominenceScore = "primary"
    } else if (mentionOrder !== null && mentionOrder <= 5 || occurrences >= 2) {
      prominenceScore = "secondary"
    } else {
      prominenceScore = "brief"
    }
  }

  // citation check
  const relayCitedUrls = sources.filter(url =>
    RELAY_DOMAINS.some(d => url.toLowerCase().includes(d))
  )
  const citationToRelay = relayCitedUrls.length > 0

  return { relayMentioned, mentionOrder, prominenceScore, citationToRelay, relayCitedUrls }
}
