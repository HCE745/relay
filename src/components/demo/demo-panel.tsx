"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Zap, ChevronUp, ChevronDown, RefreshCw, Loader2, Check, X, Keyboard, Map, Share2,
} from "lucide-react"
import { INDUSTRY_LABELS } from "@/lib/industry-templates"
import { useTour } from "./tour-context"
import { getNumTourSteps } from "./tour-steps"

type DemoPkg = "essentials" | "professional" | "professional_plus"

const PLAN_TO_PKG: Record<string, DemoPkg> = {
  essentials:        "essentials",
  pro:               "professional",
  professional_plus: "professional_plus",
}

const PACKAGES: { id: DemoPkg; label: string; activeColor: string }[] = [
  { id: "essentials",        label: "Essentials",        activeColor: "bg-gray-600 hover:bg-gray-500" },
  { id: "professional",      label: "Professional",      activeColor: "bg-blue-600 hover:bg-blue-500" },
  { id: "professional_plus", label: "Professional Plus", activeColor: "bg-purple-600 hover:bg-purple-500" },
]

const ROLES = [
  { value: "ADMIN",      label: "Admin",      color: "bg-purple-600 hover:bg-purple-700" },
  { value: "MANAGER",    label: "Manager",    color: "bg-blue-600 hover:bg-blue-700" },
  { value: "SUPERVISOR", label: "Supervisor", color: "bg-teal-600 hover:bg-teal-700" },
  { value: "HR",         label: "HR",         color: "bg-pink-600 hover:bg-pink-700" },
  { value: "EMPLOYEE",   label: "Employee",   color: "bg-gray-600 hover:bg-gray-700" },
]

const ALL_MODULES = [
  { id: "issue_intelligence",     label: "Issue Intelligence" },
  { id: "sop_intelligence",       label: "SOP Intelligence" },
  { id: "asset_intelligence",     label: "Asset Intelligence" },
  { id: "benchmark_intelligence", label: "Benchmark Intelligence" },
  { id: "purchase_intelligence",  label: "Purchase Intelligence" },
]

interface Props {
  currentRole: string
  plan: string
  intelligenceModules: string[]
  currentIndustry: string
}

export function DemoPanel({ currentRole, plan, intelligenceModules, currentIndustry }: Props) {
  const router = useRouter()
  const tour   = useTour()

  // Visibility — in-memory only (starts true, reappears on page refresh)
  const [visible, setVisible] = useState(true)
  const [open, setOpen]       = useState(false)
  const [busy, setBusy]       = useState<string | null>(null)
  const [flashMsg, setFlashMsg]         = useState("")
  const [resetCountdown, setResetCountdown] = useState<number | null>(null)
  const [resumePrompt, setResumePrompt] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Customize form
  const [editName, setEditName]             = useState("")
  const [editIndustry, setEditIndustry]     = useState("")
  const [showCustomize, setShowCustomize]   = useState(false)

  // Intelligence module local state (batched — saved on Apply)
  const [localModules, setLocalModules] = useState<string[]>(intelligenceModules)

  const panelRef = useRef<HTMLDivElement>(null)
  const isCarWashDemo = currentIndustry === "Car Wash"
  const currentPkg = PLAN_TO_PKG[plan] ?? "professional_plus"

  // Ctrl+Shift+D — hide/show panel entirely
  // Ctrl+Shift+T — toggle tour
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault()
        setVisible(v => !v)
      }
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault()
        handleTourToggle()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.isActive, tour.lastExitedStep])

  const cancelReset = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = null
    setResetCountdown(null)
  }, [])

  // Close expanded panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        cancelReset()
        setResumePrompt(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, cancelReset])

  if (!visible) return null

  const allModulesActive  = ALL_MODULES.every(m => localModules.includes(m.id))
  const modulesChanged    = JSON.stringify([...localModules].sort()) !== JSON.stringify([...intelligenceModules].sort())
  const showModules       = currentPkg !== "essentials" && !isCarWashDemo
  const activeRole        = ROLES.find(r => r.value === currentRole)

  function flash(msg: string) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(""), 2500)
  }

  function handleTourToggle() {
    if (tour.isActive) {
      tour.exitTour()
    } else if (tour.lastExitedStep && tour.lastExitedStep > 1) {
      setResumePrompt(true)
      setOpen(true)
    } else {
      tour.startTour(1)
    }
  }

  async function switchPackage(pkg: DemoPkg) {
    if (pkg === currentPkg || busy) return
    setBusy(`pkg-${pkg}`)
    try {
      const res = await fetch("/api/demo/package", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ package: pkg, modules: localModules }),
      })
      if (!res.ok) {
        flash("Failed to switch package — please try again")
        setBusy(null)
        return
      }
      window.location.assign(window.location.href)
    } catch {
      flash("Network error — please try again")
      setBusy(null)
    }
  }

  async function applyModules() {
    if (busy) return
    setBusy("modules")
    try {
      const res = await fetch("/api/demo/package", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ package: currentPkg, modules: localModules }),
      })
      if (!res.ok) {
        flash("Failed to apply modules — please try again")
        setBusy(null)
        return
      }
      window.location.assign(window.location.href)
    } catch {
      flash("Network error — please try again")
      setBusy(null)
    }
  }

  function toggleModule(id: string) {
    setLocalModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function toggleSuite() {
    setLocalModules(allModulesActive ? [] : ALL_MODULES.map(m => m.id))
  }

  async function switchRole(role: string) {
    if (role === currentRole || busy) return
    setBusy(`role-${role}`)
    try {
      const res = await fetch("/api/demo/switch-role", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ role }),
      })
      if (res.ok) window.location.reload()
    } finally {
      setBusy(null)
    }
  }

  function startResetCountdown() {
    setResetCountdown(3)
    countdownRef.current = setInterval(() => {
      setResetCountdown(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          countdownRef.current = null
          doReset()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  async function doReset() {
    setBusy("reset")
    try {
      await fetch("/api/demo/reset", { method: "POST" })
      flash("Demo data reset!")
      window.location.reload()
    } finally {
      setBusy(null)
    }
  }

  async function handleShareLink() {
    const url = `${window.location.origin}?industry=${encodeURIComponent(currentIndustry)}&package=${currentPkg}`
    try {
      await navigator.clipboard.writeText(url)
      flash("Link copied!")
    } catch {
      flash("Failed to copy link")
    }
  }

  async function handleCustomize(e: React.FormEvent) {
    e.preventDefault()
    if (!editName && !editIndustry) return
    setBusy("customize")
    try {
      const res = await fetch("/api/demo/customize", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: editName || undefined, industry: editIndustry || undefined }),
      })
      if (res.ok) {
        const json = await res.json() as { ok: boolean; reset?: boolean }
        flash(json.reset ? "Industry changed — demo data regenerated!" : "Company details updated!")
        setEditName("")
        setEditIndustry("")
        setShowCustomize(false)
        if (json.reset) window.location.reload()
        else router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={panelRef} className="fixed z-[60] bottom-20 right-3 md:bottom-4 md:right-4">
      {/* Expanded panel */}
      {open && (
        <div className="mb-2 w-[calc(100vw-24px)] max-w-[340px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/60">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-white text-sm font-bold">Demo Mode</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs flex items-center gap-1">
                <Keyboard className="w-3 h-3" />
                Ctrl+Shift+D
              </span>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Flash message */}
            {flashMsg && (
              <div className="flex items-center gap-2 text-green-400 text-xs bg-green-900/30 px-3 py-2 rounded-lg">
                <Check className="w-3.5 h-3.5" /> {flashMsg}
              </div>
            )}

            {/* Tour toggle */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center justify-between">
                <span>Guided Tour</span>
                <span className="text-gray-600 font-normal normal-case flex items-center gap-1">
                  <Keyboard className="w-3 h-3" />
                  Ctrl+Shift+T
                </span>
              </p>

              {resumePrompt ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 mb-2">
                    You exited on step {tour.lastExitedStep} of {getNumTourSteps(tour.industry)}.
                  </p>
                  <button
                    onClick={() => { setResumePrompt(false); tour.startTour(tour.lastExitedStep ?? 1) }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors min-h-[40px]"
                  >
                    Resume from Step {tour.lastExitedStep}
                  </button>
                  <button
                    onClick={() => { setResumePrompt(false); tour.startTour(1) }}
                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors min-h-[40px]"
                  >
                    Start from Beginning
                  </button>
                  <button
                    onClick={() => setResumePrompt(false)}
                    className="w-full py-1.5 text-gray-600 hover:text-gray-400 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : tour.isActive ? (
                <button
                  onClick={() => tour.exitTour()}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <X className="w-3.5 h-3.5" />
                  Exit Tour (Step {tour.currentStep}/{getNumTourSteps(tour.industry)})
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (tour.lastExitedStep && tour.lastExitedStep > 1) {
                      setResumePrompt(true)
                    } else {
                      setOpen(false)
                      tour.startTour(1)
                    }
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Map className="w-3.5 h-3.5" />
                  Start Tour
                </button>
              )}
            </div>

            {/* Package selector — hidden for Car Wash (WE is a distinct product, not a tier) */}
            {!isCarWashDemo && (
            <div data-tour="package-selector">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Package</p>
              <div className="flex flex-col gap-1.5">
                {PACKAGES.map(({ id, label, activeColor }) => {
                  const isActive = id === currentPkg
                  const isBusy  = busy === `pkg-${id}`
                  return (
                    <button
                      key={id}
                      onClick={() => switchPackage(id)}
                      disabled={isActive || !!busy}
                      className={`
                        flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium
                        transition-all min-h-[40px]
                        ${isActive
                          ? `${activeColor} text-white ring-2 ring-white/30 ring-offset-1 ring-offset-gray-900`
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"}
                      `}
                    >
                      <span>{label}</span>
                      <span className="flex items-center gap-1">
                        {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isActive && !isBusy && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            )}

            {/* Intelligence Modules (Professional and Professional Plus only) */}
            {showModules && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Intelligence Modules
                </p>
                <div className="space-y-1">
                  <label className="flex items-center gap-2.5 px-3 py-2 bg-gray-800/70 rounded-xl cursor-pointer hover:bg-gray-800">
                    <input
                      type="checkbox"
                      checked={allModulesActive}
                      onChange={toggleSuite}
                      className="accent-purple-500 w-3.5 h-3.5"
                    />
                    <span className="text-sm text-gray-200 font-medium">Intelligence Suite (All)</span>
                  </label>
                  {ALL_MODULES.map(({ id, label }) => (
                    <label key={id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-gray-800/50">
                      <input
                        type="checkbox"
                        checked={localModules.includes(id)}
                        onChange={() => toggleModule(id)}
                        className="accent-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
                {modulesChanged && (
                  <button
                    onClick={applyModules}
                    disabled={!!busy}
                    className="w-full mt-2.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    {busy === "modules" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Apply Modules
                  </button>
                )}
              </div>
            )}

            {/* Role switcher */}
            <div data-tour="role-switcher">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Viewing As
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ value, label, color }, i) => {
                  const isActive = value === currentRole
                  const isBusy  = busy === `role-${value}`
                  const isOdd   = i === ROLES.length - 1 && ROLES.length % 2 !== 0
                  return (
                    <button
                      key={value}
                      onClick={() => switchRole(value)}
                      disabled={isActive || !!busy}
                      className={`
                        flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium
                        transition-all min-h-[44px] ${isOdd ? "col-span-2" : ""}
                        ${isActive
                          ? `${color} text-white ring-2 ring-white/30 ring-offset-1 ring-offset-gray-900`
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"}
                      `}
                    >
                      {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                      {label}
                      {isActive && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Customize Company */}
            <div data-tour="industry-selector">
              <button
                type="button"
                onClick={() => setShowCustomize(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors w-full justify-between"
              >
                <span className="font-semibold uppercase tracking-wide">Customize Company</span>
                {showCustomize ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showCustomize && (
                <form onSubmit={handleCustomize} className="mt-2.5 space-y-2">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Company name…"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={editIndustry}
                    onChange={e => setEditIndustry(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Industry (unchanged)</option>
                    {INDUSTRY_LABELS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <button
                    type="submit"
                    disabled={!!busy || (!editName && !editIndustry)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    {busy === "customize" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Apply
                  </button>
                </form>
              )}
            </div>

            {/* Share demo link */}
            <div className="pt-1 border-t border-gray-800">
              <button
                onClick={handleShareLink}
                disabled={!!busy}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <Share2 className="w-3.5 h-3.5" />
                Copy Share Link
              </button>
              <p className="text-xs text-gray-600 mt-1 text-center">
                Copies a URL with current industry &amp; package
              </p>
            </div>

            {/* Reset demo data */}
            <div className="pt-1 border-t border-gray-800">
              {resetCountdown !== null ? (
                <div className="flex gap-2">
                  <button
                    disabled
                    className="flex-1 py-2.5 bg-red-900/60 text-red-300 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Resetting in {resetCountdown}…
                  </button>
                  <button
                    onClick={cancelReset}
                    className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : busy === "reset" ? (
                <button disabled className="w-full py-2.5 bg-red-600/60 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 min-h-[44px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Resetting…
                </button>
              ) : (
                <button
                  onClick={startResetCountdown}
                  disabled={!!busy}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset Demo Data
                </button>
              )}
              <p className="text-xs text-gray-600 mt-1.5 text-center">
                Wipes all data and restores sample content
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => { setOpen(v => !v); cancelReset(); setResumePrompt(false) }}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold
          transition-all active:scale-95 min-h-[44px]
          ${open
            ? "bg-gray-700 text-white"
            : "bg-gray-900 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"}
        `}
        aria-label="Demo controls"
      >
        <Zap className="w-4 h-4 text-blue-400 shrink-0" />
        <span>Demo</span>
        {activeRole && (
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${activeRole.color} text-white`}>
            {activeRole.label}
          </span>
        )}
        {tour.isActive && (
          <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-700 text-blue-200">
            Tour {tour.currentStep}/{getNumTourSteps(tour.industry)}
          </span>
        )}
        {open ? <ChevronDown className="w-3.5 h-3.5 ml-0.5" /> : <ChevronUp className="w-3.5 h-3.5 ml-0.5" />}
      </button>
    </div>
  )
}
