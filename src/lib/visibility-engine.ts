type Block = { type: string; text?: string; content?: { url?: string }[] }
type AnthropicMsg = { content: Block[] }

const MODEL = "claude-haiku-4-5-20251001"
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

export async function callWithWebSearch(prompt: string): Promise<{ text: string; sources: string[] }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      model: MODEL,
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
    .filter(b => b.type === "text")
    .map(b => b.text ?? "")
    .join("\n")
    .trim()

  const sources: string[] = []
  for (const block of data.content ?? []) {
    if (block.type === "tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.url) sources.push(item.url)
      }
    }
  }

  return { text, sources: [...new Set(sources)] }
}

export async function callForAnalysis(prompt: string): Promise<string> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(false),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Anthropic ${res.status}`)

  const data = await res.json() as AnthropicMsg
  return (data.content ?? [])
    .filter(b => b.type === "text")
    .map(b => b.text ?? "")
    .join("\n")
    .trim()
}
