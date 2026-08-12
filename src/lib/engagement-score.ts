export interface ScoredEvent {
  eventType: string
  isBotSuspected: boolean
}

const POINTS: Record<string, number> = {
  link_clicked:        10,
  tour_started:        20,
  tour_step_completed:  5,
  tour_completed:      50,
  pricing_viewed:      40,
  demo_requested:     100,
  trial_started:      150,
  returned_visit:      25,
  page_viewed:          1,
}

export function computeEngagementScore(
  events: ScoredEvent[],
  pixelOpenCount: number,
  hasRealClick: boolean,
): number {
  let score = 0
  // Pixel opens: only add 2pts if no confirmed click (to avoid double-counting interest)
  if (!hasRealClick && pixelOpenCount > 0) score += 2
  for (const e of events) {
    if (e.isBotSuspected) continue
    score += POINTS[e.eventType] ?? 0
  }
  return score
}

export function scoreLabel(score: number): "Low" | "Medium" | "High" | "Hot" {
  if (score >= 200) return "Hot"
  if (score >= 81)  return "High"
  if (score >= 31)  return "Medium"
  return "Low"
}

export function scoreColor(score: number): string {
  if (score >= 200) return "bg-red-100 text-red-700 border border-red-200"
  if (score >= 81)  return "bg-emerald-100 text-emerald-700 border border-emerald-200"
  if (score >= 31)  return "bg-blue-100 text-blue-700 border border-blue-200"
  return "bg-gray-100 text-gray-500 border border-gray-200"
}
