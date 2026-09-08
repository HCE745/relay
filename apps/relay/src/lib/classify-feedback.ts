import "server-only"
import { callHaiku } from "./ai-haiku"

export interface FeedbackClassification {
  aiClassification: string
  aiSentiment: string
  aiUrgency: string
  aiSummary: string | null
  aiConfidence: number | null
  status: "PENDING" | "ISSUE_RECOMMENDED"
}

export async function classifyFeedback(
  rating: number,
  text: string | null,
): Promise<FeedbackClassification> {
  let aiClassification: string | null = null
  let aiSentiment: string | null = null
  let aiUrgency: string | null = null
  let aiSummary: string | null = null
  let aiConfidence: number | null = null

  if (text && text.length >= 10) {
    try {
      const prompt = `Classify this customer feedback (rating: ${rating}/5). Return JSON only:
{"classification":"ACTIONABLE"|"FEEDBACK"|"POSITIVE"|"ARCHIVED","sentiment":"POSITIVE"|"NEUTRAL"|"NEGATIVE"|"MIXED","urgency":"HIGH"|"MEDIUM"|"LOW","confidence":0.0-1.0,"summary":"one sentence"}

Feedback: "${text.slice(0, 500)}"`
      const raw = await callHaiku(prompt)
      if (!raw) throw new Error("no response")
      const parsed = JSON.parse(raw) as Record<string, unknown>
      aiClassification = typeof parsed.classification === "string" ? parsed.classification : null
      aiSentiment      = typeof parsed.sentiment      === "string" ? parsed.sentiment      : null
      aiUrgency        = typeof parsed.urgency        === "string" ? parsed.urgency        : null
      aiConfidence     = typeof parsed.confidence     === "number" ? parsed.confidence     : null
      aiSummary        = typeof parsed.summary        === "string" ? parsed.summary        : null
    } catch {
      // AI is best-effort — never block submission
    }
  }

  return {
    aiClassification: aiClassification ?? (rating <= 2 ? "ACTIONABLE" : rating >= 4 ? "POSITIVE" : "FEEDBACK"),
    aiSentiment:      aiSentiment      ?? (rating <= 2 ? "NEGATIVE"   : rating >= 4 ? "POSITIVE" : "NEUTRAL"),
    aiUrgency:        aiUrgency        ?? (rating <= 2 ? "MEDIUM"     : "LOW"),
    aiSummary,
    aiConfidence,
    status:           rating <= 2 ? "ISSUE_RECOMMENDED" : "PENDING",
  }
}
