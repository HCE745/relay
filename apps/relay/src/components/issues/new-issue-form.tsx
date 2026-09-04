"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ISSUE_PRIORITY, ISSUE_CATEGORY, INJURY_SEVERITY, USER_ROLE } from "@/lib/constants"
import { GitBranch, UserCheck, Loader2, Sparkles, AlertTriangle, Copy, Lightbulb } from "lucide-react"
import { MediaUpload, type UploadedFile } from "@/components/media-upload"
import { TemplatePicker } from "@/components/issues/template-picker"
import { PeoplePicker } from "@/components/ui/people-picker"
import type { Person } from "@/components/ui/people-picker"

interface Props {
  locations: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  assets: Array<{ id: string; name: string; type: string }>
  vendors: Array<{ id: string; name: string }>
  users: Person[]
  sops?: Array<{ id: string; title: string; category: string | null }>
  issueTemplates?: Array<{ id: string; name: string; category: string | null; priority: string | null; descriptionTemplate: string | null }>
  aiSuggestionsEnabled?: boolean
  assignedLocations?: Array<{ id: string; name: string }> // employee's allowed locations
}

interface RoutingPreview {
  userId: string | null
  userName: string | null
  ruleName: string | null
  matchedConditions: number
}

export function NewIssueForm({ locations, departments, assets, vendors, users, sops = [], issueTemplates = [], aiSuggestionsEnabled = true, assignedLocations }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // AI post-submit warnings
  const [createdIssue, setCreatedIssue]         = useState<{ id: string } | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<{ similarIssueId: string; similarIssueTitle: string; confidence: number } | null>(null)
  const [titleSuggestion, setTitleSuggestion]   = useState<string | null>(null)
  const [acceptingTitle, setAcceptingTitle]       = useState(false)

  const [isInjuryMode, setIsInjuryMode] = useState(false)
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState("")
  // Auto-fill the first assigned location (single = read-only, multiple = pre-selected but changeable)
  const [locationId, setLocationId] = useState(
    assignedLocations && assignedLocations.length > 0 ? assignedLocations[0].id : ""
  )
  const [departmentId, setDepartmentId] = useState("")
  const [assetId, setAssetId] = useState("")
  const [assignedToId, setAssignedToId] = useState("")
  const [sopViolation, setSopViolation] = useState(false)
  const [sopId, setSopId] = useState("")
  const [injurySeverity, setInjurySeverity] = useState("")
  const [injuryDescription, setInjuryDescription] = useState("")
  const [injuryGuidance, setInjuryGuidance] = useState<string | null>(null)
  const [guidanceLoading, setGuidanceLoading] = useState(false)
  const injuryGuidanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [areaDetail, setAreaDetail] = useState("")
  const [attachments, setAttachments] = useState<UploadedFile[]>([])

  const [preview, setPreview] = useState<RoutingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [liveTip, setLiveTip] = useState<string | null>(null)
  const [tipLoading, setTipLoading] = useState(false)
  const [tipError, setTipError] = useState(false)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipAbortRef   = useRef<AbortController | null>(null)
  const aiBlockedRef  = useRef(false)   // true once we know suggestions are blocked/unconfigured
  const titleRef      = useRef<HTMLInputElement>(null)
  const descRef       = useRef<HTMLTextAreaElement>(null)

  const fetchPreview = useCallback(async (ctx: {
    category: string; priority: string;
    locationId: string; departmentId: string; assetId: string
  }) => {
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/issues/preview-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: ctx.category,
          priority: ctx.priority,
          locationId: ctx.locationId || null,
          departmentId: ctx.departmentId || null,
          assetId: ctx.assetId || null,
        }),
      })
      if (res.ok) setPreview(await res.json())
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const fetchLiveTip = useCallback(async (cat: string, title: string, desc: string) => {
    if (!aiSuggestionsEnabled) { setLiveTip(null); setTipError(false); return }
    if (!title.trim() && !desc.trim()) { setLiveTip(null); setTipError(false); return }
    if (aiBlockedRef.current) return  // already know AI is off/unconfigured — don't flash

    // Cancel any in-flight request
    tipAbortRef.current?.abort()
    const controller = new AbortController()
    tipAbortRef.current = controller

    setTipLoading(true)
    setTipError(false)
    try {
      const params = new URLSearchParams({ category: cat })
      if (title.trim()) params.set("title", title.trim())
      if (desc.trim()) params.set("description", desc.trim().slice(0, 400))
      const res = await fetch(`/api/analytics/suggestions?${params}`, { signal: controller.signal })
      if (!res.ok) {
        console.error("[AI Suggestion] API error:", res.status, res.statusText)
        setTipError(true)
        return
      }
      const data = await res.json() as { aiTip?: string | null; blocked?: boolean }
      if (data.blocked) {
        aiBlockedRef.current = true  // remember: don't show loading state on future keystrokes
        setLiveTip(null); setTipError(false); return
      }
      if (data.aiTip) {
        setLiveTip(data.aiTip)
        setTipError(false)
        console.log("[AI Suggestion] Live tip received, length:", data.aiTip.length)
      } else {
        console.error("[AI Suggestion] API returned empty/null aiTip")
        setTipError(true)
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      console.error("[AI Suggestion] fetch failed:", err)
      setTipError(true)
    } finally {
      setTipLoading(false)
    }
  }, [aiSuggestionsEnabled])

  function handleCategoryChange(newCategory: string) {
    setCategory(newCategory)
    if (newCategory === "INJURY") {
      setPriority("HIGH")
      setInjurySeverity("MINOR")
    } else {
      setInjurySeverity("")
      setInjuryDescription("")
      setInjuryGuidance(null)
    }
  }

  function activateInjuryMode() {
    setIsInjuryMode(true)
    setCategory("INJURY")
    setPriority("HIGH")
    if (!injurySeverity) setInjurySeverity("MINOR")
  }

  function deactivateInjuryMode() {
    setIsInjuryMode(false)
    setCategory("")
    setPriority("")
    setInjurySeverity("")
    setInjuryDescription("")
    setInjuryGuidance(null)
  }

  const fetchInjuryGuidance = useCallback(async (severity: string, description: string) => {
    if (!aiSuggestionsEnabled || !severity || !description.trim()) { setInjuryGuidance(null); return }
    if (injuryGuidanceRef.current) clearTimeout(injuryGuidanceRef.current)
    injuryGuidanceRef.current = setTimeout(async () => {
      setGuidanceLoading(true)
      try {
        const params = new URLSearchParams({ severity, description: description.slice(0, 500) })
        const res = await fetch(`/api/issues/injury-guidance?${params}`)
        if (res.ok) {
          const data = await res.json() as { guidance?: string | null; blocked?: boolean }
          setInjuryGuidance(data.guidance ?? null)
        }
      } finally {
        setGuidanceLoading(false)
      }
    }, 1000)
  }, [aiSuggestionsEnabled])

  useEffect(() => {
    if (assignedToId) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPreview({ category, priority, locationId, departmentId, assetId })
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [category, priority, locationId, departmentId, assetId, assignedToId, fetchPreview])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    const body = {
      title: formData.get("title"),
      description: formData.get("description"),
      priority,
      category,
      locationId: locationId || null,
      departmentId: departmentId || null,
      assetId: assetId || null,
      vendorId: formData.get("vendorId") || null,
      assignedToId: assignedToId || null,
      dueDate: formData.get("dueDate") || null,
      attachments,
      sopViolation,
      sopId: sopId || null,
      injurySeverity: category === "INJURY" ? injurySeverity || null : null,
      injuryDescription: category === "INJURY"
        ? (isInjuryMode ? (formData.get("description") as string || null) : (injuryDescription || null))
        : null,
      areaDetail: areaDetail || null,
    }
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const issue = await res.json() as {
          id: string
          duplicateWarning?: { similarIssueId: string; similarIssueTitle: string; confidence: number } | null
          titleSuggestion?: string | null
        }
        if (issue.duplicateWarning || issue.titleSuggestion) {
          setCreatedIssue({ id: issue.id })
          setDuplicateWarning(issue.duplicateWarning ?? null)
          setTitleSuggestion(issue.titleSuggestion ?? null)
          setLoading(false)
          return
        }
        router.push(`/issues/${issue.id}`)
        return
      }
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? "Failed to create issue")
    } catch {
      setError("Network error — please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  async function acceptTitle() {
    if (!createdIssue || !titleSuggestion) return
    setAcceptingTitle(true)
    try {
      await fetch(`/api/issues/${createdIssue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleSuggestion }),
      })
    } catch {/* best-effort */} finally {
      setAcceptingTitle(false)
    }
    router.push(`/issues/${createdIssue.id}`)
  }

  // ── Post-submit AI warning screen ────────────────────────────────────────────
  if (createdIssue) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Issue created — a few AI observations:</p>

        {duplicateWarning && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2">
              <Copy className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">Possible duplicate ({Math.round(duplicateWarning.confidence * 100)}% match)</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Looks similar to: <span className="font-medium">&ldquo;{duplicateWarning.similarIssueTitle}&rdquo;</span>
                </p>
                <a
                  href={`/issues/${duplicateWarning.similarIssueId}`}
                  className="text-xs text-amber-600 underline underline-offset-2 mt-1 inline-block"
                >
                  View similar issue →
                </a>
              </div>
            </div>
          </div>
        )}

        {titleSuggestion && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800">Suggested clearer title</p>
                <p className="text-sm text-blue-700 mt-0.5 italic">&ldquo;{titleSuggestion}&rdquo;</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {titleSuggestion && (
            <button
              type="button"
              onClick={acceptTitle}
              disabled={acceptingTitle}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {acceptingTitle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Accept suggested title
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/issues/${createdIssue.id}`)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            {titleSuggestion ? "Keep original title" : "Continue to issue"} →
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Injury mode toggle ─────────────────────────────────────────────── */}
      {isInjuryMode ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-600 text-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-sm">Reporting an Injury</span>
          </div>
          <button
            type="button"
            onClick={deactivateInjuryMode}
            className="text-red-200 hover:text-white text-xs underline underline-offset-2"
          >
            Report a different issue ×
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <TemplatePicker
            templates={issueTemplates}
            onApply={(t) => {
              if (t.category) handleCategoryChange(t.category)
              if (t.priority) setPriority(t.priority)
              if (t.descriptionTemplate && descRef.current) {
                descRef.current.value = t.descriptionTemplate
              }
            }}
          />
          <button
            type="button"
            onClick={activateInjuryMode}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Injury
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {isInjuryMode ? "Injury Summary *" : "Issue Title *"}
        </label>
        <input
          ref={titleRef}
          name="title"
          required
          placeholder={isInjuryMode ? "Brief summary of the injury" : "Brief description of the issue"}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={() => {
            if (suggestionRef.current) clearTimeout(suggestionRef.current)
            suggestionRef.current = setTimeout(() => {
              fetchLiveTip(category, titleRef.current?.value ?? "", descRef.current?.value ?? "")
            }, 1200)
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {isInjuryMode ? "What happened? *" : "Description"}
        </label>
        <textarea
          ref={descRef}
          name="description"
          rows={4}
          placeholder={isInjuryMode
            ? "Describe the injury, how it occurred, and which body part(s) were affected…"
            : "Provide details about the issue…"}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          onChange={() => {
            if (suggestionRef.current) clearTimeout(suggestionRef.current)
            suggestionRef.current = setTimeout(() => {
              fetchLiveTip(category, titleRef.current?.value ?? "", descRef.current?.value ?? "")
            }, 1500)
            if (isInjuryMode) {
              fetchInjuryGuidance(injurySeverity, descRef.current?.value ?? "")
            }
          }}
        />
      </div>

      {/* ── Injury severity + guidance (in injury mode, shown inline after description) ── */}
      {isInjuryMode && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(INJURY_SEVERITY).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setInjurySeverity(k)
                    setPriority(k === "SEVERE" ? "CRITICAL" : "HIGH")
                    fetchInjuryGuidance(k, descRef.current?.value ?? "")
                  }}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors text-center ${
                    injurySeverity === k
                      ? k === "SEVERE"
                        ? "bg-red-600 border-red-600 text-white"
                        : k === "MODERATE"
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {aiSuggestionsEnabled && (guidanceLoading || injuryGuidance) && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-amber-200 bg-amber-50">
              {guidanceLoading
                ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mt-0.5 shrink-0" />
                : <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-800 mb-1">AI First Aid Guidance</p>
                <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {guidanceLoading ? "Generating guidance…" : injuryGuidance}
                </p>
                {!guidanceLoading && injuryGuidance && (
                  <p className="text-xs text-amber-600 mt-2 italic">
                    AI-generated guidance only — not a substitute for professional medical care.{" "}
                    {injurySeverity === "SEVERE" && <strong>Call emergency services immediately for serious injuries.</strong>}
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-red-600">
            This report will immediately notify your supervisor and relevant safety contacts.
            {injurySeverity === "SEVERE" && " For life-threatening emergencies, call 911 first."}
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isInjuryMode ? "" : "sm:grid-cols-2"} gap-4`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Automatic</option>
            {Object.entries(ISSUE_PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {!isInjuryMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
              data-tour="category-select"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Automatic</option>
              {Object.entries(ISSUE_CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Injury-specific fields (dropdown path, hidden when using injury mode button) ── */}
      {category === "INJURY" && !isInjuryMode && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">Injury Report</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-red-800 mb-1.5">Severity *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(INJURY_SEVERITY).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setInjurySeverity(k)
                    setPriority(k === "SEVERE" ? "CRITICAL" : "HIGH")
                    fetchInjuryGuidance(k, injuryDescription)
                  }}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors text-center ${
                    injurySeverity === k
                      ? k === "SEVERE"
                        ? "bg-red-600 border-red-600 text-white"
                        : k === "MODERATE"
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-red-800 mb-1.5">What happened? *</label>
            <textarea
              value={injuryDescription}
              onChange={e => {
                setInjuryDescription(e.target.value)
                fetchInjuryGuidance(injurySeverity, e.target.value)
              }}
              rows={3}
              placeholder="Describe the injury, how it occurred, and which body part(s) were affected…"
              className="w-full px-3.5 py-2.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-white"
            />
          </div>

          {/* AI first aid guidance */}
          {aiSuggestionsEnabled && (guidanceLoading || injuryGuidance) && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-amber-200 bg-amber-50">
              {guidanceLoading
                ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mt-0.5 shrink-0" />
                : <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-800 mb-1">AI First Aid Guidance</p>
                <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {guidanceLoading ? "Generating guidance…" : injuryGuidance}
                </p>
                {!guidanceLoading && injuryGuidance && (
                  <p className="text-xs text-amber-600 mt-2 italic">
                    This is AI-generated guidance only — not a substitute for professional medical care.{" "}
                    {injurySeverity === "SEVERE" && <strong>Call emergency services immediately for serious injuries.</strong>}
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-red-600">
            This report will immediately notify your supervisor and relevant safety contacts.
            {injurySeverity === "SEVERE" && " For life-threatening emergencies, call 911 first."}
          </p>
        </div>
      )}

      {/* Live AI tip — only shown while loading or when a tip was actually returned */}
      {aiSuggestionsEnabled && (tipLoading || liveTip) && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm">
          {tipLoading
            ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mt-0.5 shrink-0" />
            : <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-amber-900 leading-relaxed">
              {tipLoading
                ? <span className="text-amber-400 italic">Generating suggestion…</span>
                : liveTip}
            </p>
            {!tipLoading && liveTip && (
              <p className="text-amber-500 text-xs mt-1.5">AI Suggestions are a beta feature and will continue to improve over time.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
          {assignedLocations && assignedLocations.length === 1 ? (
            // Single assigned location — show as read-only
            <div className="w-full px-3.5 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
              {assignedLocations[0].name}
            </div>
          ) : (
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Automatic</option>
              {(assignedLocations && assignedLocations.length > 0 ? assignedLocations : locations).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
          <select
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Automatic</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Specific Area <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          value={areaDetail}
          onChange={e => setAreaDetail(e.target.value)}
          placeholder="e.g. Loading dock bay 3, break room near west entrance"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Asset (optional)</label>
          <select
            value={assetId}
            onChange={e => setAssetId(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">No asset</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor (optional)</label>
          <select
            name="vendorId"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">No vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignee</label>
        <PeoplePicker
          people={users}
          value={assignedToId}
          onChange={setAssignedToId}
          placeholder="Search by name, role, department…"
          emptyLabel="Automatic (use routing rules)"
        />
        {/* Auto-routing preview — only shown when assignee is Automatic */}
        {!assignedToId && (
          <div className={`flex items-center gap-2.5 mt-2 px-3 py-2 rounded-lg border text-xs ${
            preview?.userId
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-gray-50 border-gray-200 text-gray-500"
          }`}>
            {previewLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              : preview?.userId
                ? <UserCheck className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                : <GitBranch className="w-3.5 h-3.5 shrink-0" />
            }
            {previewLoading ? (
              <span className="text-gray-400">Checking routing rules…</span>
            ) : preview?.userId ? (
              <span>
                <span className="font-medium">Will route to {preview.userName}</span>
                {preview.ruleName && <span className="text-blue-600"> via &ldquo;{preview.ruleName}&rdquo;</span>}
              </span>
            ) : (
              <span>No routing rule matched — will be unassigned</span>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
        <input
          name="dueDate"
          type="date"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* SOP violation */}
      {sops.length > 0 && (
        <div className="space-y-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sopViolation}
              onChange={e => { setSopViolation(e.target.checked); if (!e.target.checked) setSopId("") }}
              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-amber-900">This issue involves an SOP violation</span>
          </label>
          {sopViolation && (
            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">Related SOP (optional)</label>
              <select
                value={sopId}
                onChange={e => setSopId(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select an SOP…</option>
                {sops.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Media upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Photos / Videos</label>
        <MediaUpload value={attachments} onChange={setAttachments} />
      </div>

      <div className="flex gap-3 pt-2 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Submitting…" : "Submit Issue"}
        </button>
      </div>
    </form>
  )
}
