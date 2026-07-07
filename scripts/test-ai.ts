/**
 * Run with: npx tsx scripts/test-ai.ts
 * Tests that the Anthropic API key is valid and the model responds correctly.
 */

import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
  console.error("❌ ANTHROPIC_API_KEY is not set in .env")
  console.error("   Get your key at https://console.anthropic.com/ and add it to .env:")
  console.error('   ANTHROPIC_API_KEY="sk-ant-..."')
  process.exit(1)
}

console.log("🔑 API key found:", apiKey.slice(0, 12) + "...")
console.log("📡 Sending test request to Anthropic API...\n")

async function test() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: 'Reply with exactly: "AI suggestions working correctly."',
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  })

  console.log("HTTP status:", res.status, res.statusText)

  const body = await res.json()
  console.log("Full response:", JSON.stringify(body, null, 2))

  if (!res.ok) {
    console.error("\n❌ API call failed — check the error above")
    process.exit(1)
  }

  const text = body.content?.find((c: { type: string }) => c.type === "text")?.text
  if (text) {
    console.log("\n✅ Success! Model responded:", text)
  } else {
    console.error("\n⚠️  Response OK but no text content found")
    process.exit(1)
  }
}

test().catch((err) => {
  console.error("\n❌ Request threw an error:", err)
  process.exit(1)
})
