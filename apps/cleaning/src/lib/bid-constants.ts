// Prisma-free bid constants, safe to import from client components (importing
// bid-math would pull the Prisma client — and node:async_hooks — into the
// browser bundle).

// Visits per month by cadence — bridges a per-visit production rate to a monthly
// bid. Mirrors ServiceFrequency.
export const VISITS_PER_MONTH: Record<string, number> = {
  DAILY: 21.67, // ~working days
  WEEKLY: 4.33,
  BIWEEKLY: 2.17,
  MONTHLY: 1,
  ONE_TIME: 1,
  CUSTOM: 4.33,
}

// Industry-standard starting points (sq ft/hour), seeded per org then tuned.
export const DEFAULT_PRODUCTION_RATES: { taskType: string; surfaceType: string; sqftPerHour: number }[] = [
  { taskType: "Vacuuming", surfaceType: "Carpet (open area)", sqftPerHour: 7000 },
  { taskType: "Vacuuming", surfaceType: "Carpet (congested)", sqftPerHour: 4000 },
  { taskType: "Dust mopping", surfaceType: "Hard floor (open)", sqftPerHour: 9000 },
  { taskType: "Damp mopping", surfaceType: "Hard floor", sqftPerHour: 4000 },
  { taskType: "Auto-scrubbing", surfaceType: "Hard floor", sqftPerHour: 18000 },
  { taskType: "Restroom cleaning", surfaceType: "Restroom (per fixture set)", sqftPerHour: 500 },
  { taskType: "Trash removal", surfaceType: "Office (per workstation area)", sqftPerHour: 6000 },
  { taskType: "Dusting", surfaceType: "Office surfaces", sqftPerHour: 5000 },
  { taskType: "High dusting", surfaceType: "Overhead", sqftPerHour: 3000 },
  { taskType: "Glass / entryway", surfaceType: "Glass", sqftPerHour: 2500 },
]
