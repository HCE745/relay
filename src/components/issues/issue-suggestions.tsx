"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, Database, ChevronDown, ChevronUp, BookOpen, AlertTriangle } from "lucide-react"

interface Props {
  issueId: string
  initialSubmitterSuggestion: string | null
  initialAssigneeSuggestion: string | null
  showSubmitter: boolean
  showAssignee: boolean
  isSubmitter: boolean
  isAssignee: boolean
  isAdminOrManager: boolean
  defaultCollapsed: boolean
  defaultSopCollapsed: boolean
  // SOP signal — shown when a SOP is linked and viewer is assignee or admin/manager
  sopId?: string | null
  sopTitle?: string | null
  sopViolation?: boolean
  sopMatchConfidence?: number | null
  sopViolationNote?: string | null
  sopLinkSource?: string | null
}

interface Section {
  heading: string
  body: string
}

// Extract <!-- hist:N --> prefix and return count + cleaned text
function extractHistCount(text: string): { count: number | null; text: string } {
  const match = text.match(/^<!-- hist:(\d+) -->\n?/)
  if (!match) return { count: null, text }
  return { count: parseInt(match[1], 10), text: text.slice(match[0].length) }
}

// Split text into ## sections
function parseSections(text: string): Section[] {
  const sections: Section[] = []
  let current: { heading: string; lines: string[] } | null = null

  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() })
      current = { heading: line.slice(3).trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() })
  return sections
}

// Render body text: convert **label:** value lines to styled elements
function BodyText({ text, textColor }: { text: string; textColor: string }) {
  const lines = text.split("\n").filter((l) => l.trim())
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
        if (boldMatch) {
          return (
            <div key={i} className={`text-sm ${textColor} leading-relaxed`}>
              <span className="font-semibold">{boldMatch[1]}:</span>{" "}
              {boldMatch[2]}
            </div>
          )
        }
        return (
          <p key={i} className={`text-sm ${textColor} leading-relaxed`}>
            {line}
          </p>
        )
      })}
    </div>
  )
}

function SopViolationCallout({
  sopId,
  sopTitle,
  sopViolation,
  sopMatchConfidence,
  sopViolationNote,
  sopLinkSource,
  defaultCollapsed,
}: {
  sopId: string
  sopTitle: string
  sopViolation: boolean
  sopMatchConfidence: number | null
  sopViolationNote: string | null
  sopLinkSource: string | null
  defaultCollapsed: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const isViolation = sopViolation && !!sopViolationNote
  const confidencePct = sopMatchConfidence !== null ? Math.round(sopMatchConfidence * 100) : null
  const Chevron = collapsed ? ChevronDown : ChevronUp

  return (
    <div className={`mb-4 rounded-xl border overflow-hidden ${isViolation ? "border-orange-300 bg-orange-50" : "border-teal-200 bg-teal-50"}`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:brightness-95
          ${!collapsed ? `border-b ${isViolation ? "border-orange-200" : "border-teal-100"}` : ""}
          ${isViolation ? "bg-orange-100/60" : "bg-teal-100/60"}`}
      >
        {isViolation
          ? <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          : <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        }
        <span className={`text-xs font-semibold uppercase tracking-wide ${isViolation ? "text-orange-800" : "text-teal-800"}`}>
          {isViolation ? "Possible SOP Violation" : "Related SOP"}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isViolation ? "bg-orange-100 text-orange-600" : "bg-teal-100 text-teal-600"}`}>
          Process / Compliance
        </span>
        {confidencePct !== null && sopLinkSource === "AI" && (
          <span className="text-[10px] text-gray-400">AI matched · {confidencePct}%</span>
        )}
        {sopLinkSource === "MANUAL" && (
          <span className="text-[10px] text-gray-400">Manually linked</span>
        )}
        <Chevron className={`w-3.5 h-3.5 ml-auto shrink-0 ${isViolation ? "text-orange-400" : "text-teal-400"}`} />
      </button>
      {!collapsed && (
        <div className="px-4 py-3 space-y-1.5">
          <a
            href={`/sops/${sopId}`}
            className={`text-sm font-medium hover:underline ${isViolation ? "text-orange-800" : "text-teal-800"}`}
          >
            {sopTitle}
          </a>
          {sopViolationNote && (
            <p className={`text-sm leading-relaxed ${isViolation ? "text-orange-900" : "text-teal-900"}`}>
              {sopViolationNote}
            </p>
          )}
          <p className={`text-[11px] ${isViolation ? "text-orange-400" : "text-teal-400"}`}>
            {isViolation
              ? "Review the linked SOP before resolving — use the SOP Compliance Outcome field when closing this issue."
              : "This SOP may be relevant to diagnosing or resolving this issue."}
          </p>
        </div>
      )}
    </div>
  )
}

function SuggestionPanel({
  label,
  adminLabel,
  isPersonal,
  showAdminBadge,
  suggestion,
  loading,
  timedOut,
  defaultCollapsed,
  accentColors,
}: {
  label: string
  adminLabel: string
  isPersonal: boolean
  showAdminBadge: boolean
  suggestion: string | null
  loading: boolean
  timedOut: boolean
  defaultCollapsed: boolean
  accentColors: {
    border: string
    bg: string
    headerBg: string
    headerBorder: string
    icon: string
    label: string
    adminBadgeBg: string
    adminBadgeText: string
    footerText: string
    sectionBorder: string
    sectionBg: string
    headingText: string
    bodyText: string
    histBg: string
    histText: string
    histIcon: string
    chevron: string
  }
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (!suggestion && !loading && !timedOut) return null

  // Loading / timed-out state — always shown, no collapse toggle
  if (!suggestion) {
    return (
      <div className={`mb-4 rounded-xl border ${accentColors.border} ${accentColors.bg} overflow-hidden`}>
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${accentColors.headerBorder} ${accentColors.headerBg}`}>
          <Sparkles className={`w-3.5 h-3.5 ${accentColors.icon} shrink-0`} />
          <span className={`text-xs font-semibold ${accentColors.label} uppercase tracking-wide`}>
            {isPersonal ? label : adminLabel}
          </span>
        </div>
        {timedOut ? (
          <p className={`px-4 py-3 text-sm ${accentColors.footerText} italic`}>
            AI guidance could not be generated for this issue.
          </p>
        ) : (
          <div className={`flex items-center gap-2 px-4 py-3 text-sm ${accentColors.footerText}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="italic">Generating…</span>
          </div>
        )}
      </div>
    )
  }

  const { count: histCount, text: cleanText } = extractHistCount(suggestion)
  const sections = parseSections(cleanText)
  const hasStructure = sections.length > 0
  const Chevron = collapsed ? ChevronDown : ChevronUp

  return (
    <div className={`mb-4 rounded-xl border ${accentColors.border} ${accentColors.bg} overflow-hidden`}>
      {/* Clickable header — toggles collapse */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors
          ${!collapsed ? `border-b ${accentColors.headerBorder}` : ""}
          ${accentColors.headerBg} hover:brightness-95`}
      >
        <Sparkles className={`w-3.5 h-3.5 ${accentColors.icon} shrink-0`} />
        <span className={`text-xs font-semibold ${accentColors.label} uppercase tracking-wide`}>
          {isPersonal ? label : adminLabel}
        </span>
        {histCount !== null && histCount > 0 && (
          <span className={`flex items-center gap-1 text-[10px] ${accentColors.histText} ${accentColors.histBg} px-1.5 py-0.5 rounded`}>
            <Database className={`w-2.5 h-2.5 ${accentColors.histIcon}`} />
            Based on {histCount} similar resolved issue{histCount !== 1 ? "s" : ""}
          </span>
        )}
        {showAdminBadge && !(histCount !== null && histCount > 0) && (
          <span className={`text-[10px] ${accentColors.adminBadgeText} ${accentColors.adminBadgeBg} px-1.5 py-0.5 rounded`}>
            shown to {isPersonal ? "you" : label.toLowerCase()}
          </span>
        )}
        <Chevron className={`w-3.5 h-3.5 ${accentColors.chevron} ml-auto shrink-0`} />
      </button>

      {!collapsed && (
        <>
          <div className="px-4 py-3 space-y-3">
            {hasStructure ? (
              sections.map((sec, i) => (
                <div
                  key={i}
                  className={`rounded-lg border ${accentColors.sectionBorder} ${accentColors.sectionBg} px-3 py-2.5`}
                >
                  <div className={`text-xs font-bold ${accentColors.headingText} uppercase tracking-wide mb-1.5`}>
                    {sec.heading}
                  </div>
                  <BodyText text={sec.body} textColor={accentColors.bodyText} />
                </div>
              ))
            ) : (
              <p className={`text-sm ${accentColors.bodyText} leading-relaxed`}>{cleanText}</p>
            )}
          </div>
          <p className={`px-4 pb-3 text-[11px] ${accentColors.footerText}`}>
            AI Suggestions are a beta feature and will continue to improve over time.
          </p>
        </>
      )}
    </div>
  )
}

export function IssueSuggestions({
  issueId,
  initialSubmitterSuggestion,
  initialAssigneeSuggestion,
  showSubmitter,
  showAssignee,
  isSubmitter,
  isAssignee,
  isAdminOrManager,
  defaultCollapsed,
  defaultSopCollapsed,
  sopId,
  sopTitle,
  sopViolation,
  sopMatchConfidence,
  sopViolationNote,
  sopLinkSource,
}: Props) {
  const [submitterSuggestion, setSubmitterSuggestion] = useState(initialSubmitterSuggestion)
  const [assigneeSuggestion, setAssigneeSuggestion] = useState(initialAssigneeSuggestion)
  const [timedOut, setTimedOut] = useState(false)

  const wantSubmitter = showSubmitter && !initialSubmitterSuggestion
  const wantAssignee = showAssignee && !initialAssigneeSuggestion

  useEffect(() => {
    if (!wantSubmitter && !wantAssignee) return

    let cancelled = false

    async function run() {
      // Kick off generation first (no-op if already generated or not available)
      try {
        await fetch(`/api/issues/${issueId}/suggestions`, { method: "POST" })
      } catch {
        // Non-fatal — continue polling regardless
      }

      if (cancelled) return

      let polls = 0
      const timer = setInterval(async () => {
        if (cancelled) { clearInterval(timer); return }
        polls++
        if (polls > 14) {
          setTimedOut(true)
          clearInterval(timer)
          return
        }
        try {
          const res = await fetch(`/api/issues/${issueId}/suggestions`)
          if (!res.ok) return
          const data = await res.json() as {
            submitterSuggestion: string | null
            assigneeSuggestion: string | null
          }
          if (data.submitterSuggestion) setSubmitterSuggestion(data.submitterSuggestion)
          if (data.assigneeSuggestion) setAssigneeSuggestion(data.assigneeSuggestion)
          const done =
            (!wantSubmitter || !!data.submitterSuggestion) &&
            (!wantAssignee || !!data.assigneeSuggestion)
          if (done) clearInterval(timer)
        } catch {
          // Ignore transient fetch errors
        }
      }, 2500)
    }

    run()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showingAssignee = showAssignee && (assigneeSuggestion || wantAssignee)
  const showingSubmitter = showSubmitter && (submitterSuggestion || wantSubmitter)

  // Show SOP callout to assignee and admins/managers when there is a linked SOP
  const showSopCallout = !!(sopId && sopTitle && (isAssignee || isAdminOrManager))

  if (!showingAssignee && !showingSubmitter && !showSopCallout) return null

  const blueColors = {
    border: "border-blue-200",
    bg: "bg-blue-50",
    headerBg: "bg-blue-100/60",
    headerBorder: "border-blue-100",
    icon: "text-blue-600",
    label: "text-blue-800",
    adminBadgeBg: "bg-blue-100",
    adminBadgeText: "text-blue-500",
    footerText: "text-blue-400",
    sectionBorder: "border-blue-200",
    sectionBg: "bg-white/70",
    headingText: "text-blue-700",
    bodyText: "text-blue-900",
    histBg: "bg-blue-100",
    histText: "text-blue-600",
    histIcon: "text-blue-500",
    chevron: "text-blue-400",
  }

  const amberColors = {
    border: "border-amber-200",
    bg: "bg-amber-50",
    headerBg: "bg-amber-100/60",
    headerBorder: "border-amber-100",
    icon: "text-amber-600",
    label: "text-amber-800",
    adminBadgeBg: "bg-amber-100",
    adminBadgeText: "text-amber-500",
    footerText: "text-amber-400",
    sectionBorder: "border-amber-200",
    sectionBg: "bg-white/70",
    headingText: "text-amber-700",
    bodyText: "text-amber-900",
    histBg: "bg-amber-100",
    histText: "text-amber-600",
    histIcon: "text-amber-500",
    chevron: "text-amber-400",
  }

  return (
    <>
      {showSopCallout && (
        <SopViolationCallout
          sopId={sopId!}
          sopTitle={sopTitle!}
          sopViolation={sopViolation ?? false}
          sopMatchConfidence={sopMatchConfidence ?? null}
          sopViolationNote={sopViolationNote ?? null}
          sopLinkSource={sopLinkSource ?? null}
          defaultCollapsed={defaultSopCollapsed}
        />
      )}
      {showingAssignee && (
        <SuggestionPanel
          label="Guidance for you"
          adminLabel="Assignee guidance"
          isPersonal={isAssignee}
          showAdminBadge={isAdminOrManager && !isAssignee}
          suggestion={assigneeSuggestion}
          loading={wantAssignee && !assigneeSuggestion}
          timedOut={timedOut && !assigneeSuggestion}
          defaultCollapsed={defaultCollapsed}
          accentColors={blueColors}
        />
      )}
      {showingSubmitter && (
        <SuggestionPanel
          label="What to expect"
          adminLabel="Submitter info"
          isPersonal={isSubmitter}
          showAdminBadge={isAdminOrManager && !isSubmitter}
          suggestion={submitterSuggestion}
          loading={wantSubmitter && !submitterSuggestion}
          timedOut={timedOut && !submitterSuggestion}
          defaultCollapsed={defaultCollapsed}
          accentColors={amberColors}
        />
      )}
    </>
  )
}
