// ─── Intelligent shift matching (Phase 47) ───────────────────────────────────
//
// Pure, deterministic ranking that EXTENDS the Phase 11 coverage finder — it
// never replaces its availability/not-busy filtering. Given the facts the
// finder gathers for each already-available candidate, it scores how well the
// candidate matches a site's required skills and credentials, on top of site
// work history. No AI.
//
// KEY INVARIANT: with no skill and no credential requirements, every candidate
// is "qualified" with a null match score, so ranking falls through to site
// history + name — exactly the Phase 11 behavior.

export type CandidateFacts = {
  userId: string
  name: string
  priorJobsAtSite: number
  requiredSkills: string[] // skill names the site requires
  matchedSkills: string[] // of the required skills, the ones the candidate holds
  requiredCredentials: string[] // credential types the site requires
  missingCredentials: { type: string; reason: "missing" | "expired" }[]
}

export type RankedCandidate = CandidateFacts & {
  missingSkills: string[]
  qualified: boolean // meets every skill AND credential requirement
  requirementsMet: number
  requirementsTotal: number
  matchScore: number | null // percent of requirements met; null when none required
}

export function rankCandidate(f: CandidateFacts): RankedCandidate {
  const matched = new Set(f.matchedSkills)
  const missingSkills = f.requiredSkills.filter((s) => !matched.has(s))
  const requirementsTotal = f.requiredSkills.length + f.requiredCredentials.length
  const credentialsMet = f.requiredCredentials.length - f.missingCredentials.length
  const requirementsMet = f.matchedSkills.length + credentialsMet
  const qualified = missingSkills.length === 0 && f.missingCredentials.length === 0
  const matchScore = requirementsTotal === 0 ? null : Math.round((requirementsMet / requirementsTotal) * 100)
  return { ...f, missingSkills, qualified, requirementsMet, requirementsTotal, matchScore }
}

/**
 * Rank candidates best-fit first: fully-qualified ahead of partially-qualified,
 * then by match score, then by site work history, then by name. A null match
 * score (no requirements) ties at the top so history breaks the tie.
 */
export function rankCandidates(facts: CandidateFacts[]): RankedCandidate[] {
  return facts.map(rankCandidate).sort(compareCandidates)
}

export function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (a.qualified !== b.qualified) return a.qualified ? -1 : 1
  const as = a.matchScore ?? 100
  const bs = b.matchScore ?? 100
  if (as !== bs) return bs - as
  if (a.priorJobsAtSite !== b.priorJobsAtSite) return b.priorJobsAtSite - a.priorJobsAtSite
  return a.name.localeCompare(b.name)
}
