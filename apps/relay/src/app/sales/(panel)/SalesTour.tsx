"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, X, Users, TrendingUp } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

type TourRole = "rep" | "manager"

interface Step {
  title: string
  body: string
  path: string
  selector: string | null
}

// ── sessionStorage keys ────────────────────────────────────────────────────────

const SK_DISMISSED = "sales-tour-dismissed"
const SK_ROLE      = "sales-tour-role"
const SK_STEP      = "sales-tour-step"

function ss(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function ssSet(key: string, val: string) {
  try { sessionStorage.setItem(key, val) } catch { /* */ }
}

// ── Step definitions ───────────────────────────────────────────────────────────

const REP_STEPS: Step[] = [
  {
    title: "Welcome to Relay CRM",
    body: "This is your sales workspace. Everything you need to prospect, outreach, follow up, and close deals is here. Let us show you around.",
    path: "/sales",
    selector: null,
  },
  {
    title: "Start here every morning",
    body: "Your action center shows exactly who needs attention today — overdue follow-ups, replies waiting, engaged prospects, and upcoming demos.",
    path: "/sales",
    selector: "[data-tour='rep-action-center']",
  },
  {
    title: "Find new accounts",
    body: "Tell the AI what kind of company you are looking for. It finds real companies, researches them, and drafts your first email — all automatically.",
    path: "/sales",
    selector: "a[href='/sales/outreach/prospects/discover']",
  },
  {
    title: "AI researches every company",
    body: "Click any prospect to see an AI-generated research summary — pain points, why they are a fit for Relay, and a suggested outreach angle. You never go into a call blind.",
    path: "/sales/outreach/prospects",
    selector: "[data-tour='rep-research-hint']",
  },
  {
    title: "Every account has one owner",
    body: "When you claim an account it is yours. Other reps cannot contact companies you are actively working without a collision warning.",
    path: "/sales/outreach/prospects",
    selector: "a[href='/sales/outreach/prospects']",
  },
  {
    title: "Send and track outreach",
    body: "Send personalized emails directly from the CRM. You will see when prospects open emails, click your tour link, and how far they get through the demo.",
    path: "/sales/outreach/email",
    selector: "[data-tour='rep-link-tracking']",
  },
  {
    title: "See exactly what they clicked",
    body: "Every link in your emails is tracked. You can see if they clicked your tour link, how many steps they completed, how long they spent, and whether they viewed pricing.",
    path: "/sales/outreach/email",
    selector: "[data-tour='rep-link-tracking']",
  },
  {
    title: "Know who is interested",
    body: "When a prospect completes the demo tour or views pricing, they appear here as a hot lead. Call them first.",
    path: "/sales/demo-analytics",
    selector: "a[href='/sales/demo-analytics']",
  },
  {
    title: "Never miss a follow-up",
    body: "The system tracks where each prospect is in your sequence and tells you exactly when to follow up and what to say.",
    path: "/sales/outreach/follow-ups",
    selector: "[data-tour='rep-stage-system']",
  },
  {
    title: "Know where every prospect stands",
    body: "The system tracks which follow-up stage each prospect is in — first email, first follow-up, second follow-up. You always know the history without reading every email thread.",
    path: "/sales/outreach/follow-ups",
    selector: "[data-tour='rep-stage-system']",
  },
  {
    title: "Manage your deals",
    body: "Move opportunities through stages as deals progress. Each card shows the next action due and flags anything overdue.",
    path: "/sales/pipeline",
    selector: "a[href='/sales/pipeline']",
  },
  {
    title: "Your earnings",
    body: "Every customer you close generates commission automatically based on your agreement. You can see pending, approved, and paid commissions here at any time.",
    path: "/sales/commission",
    selector: "a[href='/sales/commission']",
  },
  {
    title: "You are ready",
    body: "That covers the essentials. Explore the sidebar to see everything else available. Your manager can answer any questions about your specific territory or targets.",
    path: "/sales",
    selector: null,
  },
]

const MANAGER_STEPS: Step[] = [
  {
    title: "Welcome to Relay CRM — Manager View",
    body: "As a sales manager you have visibility into the full team, account ownership, commission approvals, and administrative controls.",
    path: "/sales/manager",
    selector: null,
  },
  {
    title: "Your team at a glance",
    body: "See every salesperson's activity, pipeline value, follow-ups completed, and overdue tasks in one view.",
    path: "/sales/manager",
    selector: "[data-tour='mgr-dashboard-header']",
  },
  {
    title: "Track conversion at every stage",
    body: "See exactly where prospects drop out of your pipeline — from first contact through to closed won. Spot which stage needs the most attention.",
    path: "/sales/manager",
    selector: "[data-tour='mgr-funnel']",
  },
  {
    title: "Who owns what",
    body: "Every prospect company is assigned to one salesperson. You can see their full account list, activity status, and when they last made contact.",
    path: "/sales/accounts",
    selector: "a[href='/sales/accounts']",
  },
  {
    title: "Catch stalled accounts",
    body: "Accounts with no outreach after 7 days or no activity after 30 days are flagged automatically. You decide whether to reassign, extend, or release them.",
    path: "/sales/manager",
    selector: "[data-tour='mgr-overdue-section']",
  },
  {
    title: "Prevent competing outreach",
    body: "When a salesperson creates a company that looks like a duplicate it is flagged here for your review. You can merge, dismiss, or investigate.",
    path: "/sales/manager",
    selector: "[data-tour='mgr-dup-banner']",
  },
  {
    title: "Transfer accounts",
    body: "Only managers and admins can reassign accounts. Every transfer is logged with the reason and timestamp for a permanent audit trail.",
    path: "/sales/outreach/prospects",
    selector: "a[href='/sales/outreach/prospects']",
  },
  {
    title: "Active deals are protected",
    body: "Accounts with scheduled demos or open opportunities at Demo stage or later are marked Protected. Reassigning them requires an explicit admin override.",
    path: "/sales/outreach/prospects",
    selector: "a[href='/sales/outreach/prospects']",
  },
  {
    title: "Full pipeline visibility",
    body: "See every open opportunity across the team grouped by stage and salesperson. Spot stalled deals before they are lost.",
    path: "/sales/pipeline",
    selector: "a[href='/sales/pipeline']",
  },
  {
    title: "Controlled account transfers",
    body: "Reps can request account transfers but only managers approve them. Every transfer is logged permanently so there are never disputes about who owned an account.",
    path: "/sales/manager",
    selector: "[data-tour='mgr-transfers']",
  },
  {
    title: "Approve commissions",
    body: "When customers pay Relay the system calculates each salesperson's commission automatically. You review and approve before any payment is made.",
    path: "/sales/manager/commissions",
    selector: "a[href='/sales/manager/commissions']",
  },
  {
    title: "Full commission history",
    body: "Every payment, every calculation, and every approval is recorded permanently. You can export the ledger for accounting at any time.",
    path: "/sales/manager/commissions",
    selector: "[data-tour='mgr-commission-history']",
  },
  {
    title: "Handle collaborative deals",
    body: "When two salespeople work a deal together you can configure a commission split. Splits come from the agreed pool — they never stack or exceed the total commission.",
    path: "/sales/manager/commissions",
    selector: "a[href='/sales/manager/commissions']",
  },
  {
    title: "Manage your team",
    body: "Add new salespeople, set their commission rate and duration, and deactivate accounts when someone leaves. Historical commissions are preserved when a rep is deactivated.",
    path: "/sales/settings/team",
    selector: "a[href='/sales/settings/team']",
  },
  {
    title: "You have the full picture",
    body: "You now have oversight of accounts, activity, pipeline, and commissions across the team. Use the manager dashboard as your daily starting point.",
    path: "/sales/manager",
    selector: null,
  },
]

// ── Spotlight utilities ────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }

function waitForEl(selector: string, ms = 6000): Promise<Element | null> {
  return new Promise(resolve => {
    const el = document.querySelector(selector)
    if (el) { resolve(el); return }
    const t0 = Date.now()
    const iv = setInterval(() => {
      const found = document.querySelector(selector)
      if (found) { clearInterval(iv); resolve(found); return }
      if (Date.now() - t0 > ms) { clearInterval(iv); resolve(null) }
    }, 100)
  })
}

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const CARD_W = 360
const CARD_H = 300

function cardPos(rect: Rect): React.CSSProperties {
  const PAD = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  const elCenterX = rect.left + rect.width / 2
  const elCenterY = rect.top + rect.height / 2

  // Right side: element is in left half AND there's room
  if (elCenterX < vw / 2 && rect.left + rect.width + PAD + CARD_W <= vw) {
    return {
      position: "fixed",
      top: Math.max(PAD, Math.min(elCenterY - CARD_H / 2, vh - CARD_H - PAD)),
      left: rect.left + rect.width + PAD,
      width: CARD_W,
    }
  }

  // Left side: element is in right half AND there's room
  if (elCenterX >= vw / 2 && rect.left - PAD - CARD_W >= 0) {
    return {
      position: "fixed",
      top: Math.max(PAD, Math.min(elCenterY - CARD_H / 2, vh - CARD_H - PAD)),
      left: rect.left - PAD - CARD_W,
      width: CARD_W,
    }
  }

  // Above or below: full-width or centered element
  const centeredLeft = Math.max(PAD, Math.min(elCenterX - CARD_W / 2, vw - CARD_W - PAD))

  // Above: element is in the lower half
  if (elCenterY > vh / 2 && rect.top - PAD - CARD_H >= PAD) {
    return {
      position: "fixed",
      top: rect.top - PAD - CARD_H,
      left: centeredLeft,
      width: CARD_W,
    }
  }

  // Below: default
  return {
    position: "fixed",
    top: Math.min(rect.top + rect.height + PAD, vh - CARD_H - PAD),
    left: centeredLeft,
    width: CARD_W,
  }
}

function fallbackPos(): React.CSSProperties {
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280
  const vh = typeof window !== "undefined" ? window.innerHeight : 900
  return {
    position: "fixed",
    top:  Math.max(16, vh - CARD_H - 24),
    left: Math.max(16, vw - CARD_W - 24),
    width: CARD_W,
  }
}

// ── Role Picker ────────────────────────────────────────────────────────────────

function RolePicker({ defaultRole, onSelect, onSkip }: {
  defaultRole: TourRole
  onSelect: (r: TourRole) => void
  onSkip: () => void
}) {
  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/25 rounded-full mb-5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-300 font-medium tracking-wide">Relay CRM — Guided Tour</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">How would you like to explore?</h1>
          <p className="text-sm text-gray-400">Choose a role to see the features most relevant to you.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => onSelect("rep")}
            className={`flex flex-col items-start gap-3 p-5 rounded-2xl border transition-all text-left ${
              defaultRole === "rep"
                ? "bg-emerald-600/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
                : "bg-gray-900 border-gray-700 hover:border-gray-500"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">Sales Rep</p>
              <p className="text-xs text-gray-400 leading-relaxed">I prospect and close deals</p>
            </div>
            <p className="text-[11px] text-gray-600">13 steps · ~4 min</p>
          </button>

          <button
            onClick={() => onSelect("manager")}
            className={`flex flex-col items-start gap-3 p-5 rounded-2xl border transition-all text-left ${
              defaultRole === "manager"
                ? "bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/30"
                : "bg-gray-900 border-gray-700 hover:border-gray-500"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">Sales Manager</p>
              <p className="text-xs text-gray-400 leading-relaxed">I oversee the team</p>
            </div>
            <p className="text-[11px] text-gray-600">15 steps · ~5 min</p>
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Skip Tour — explore on my own
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main tour component ────────────────────────────────────────────────────────

export function SalesTour({ isDemo, defaultRole }: { isDemo: boolean; defaultRole: TourRole }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [phase, setPhase]     = useState<"picker" | "active" | "hidden">("hidden")
  const [role, setRole]       = useState<TourRole>(defaultRole)
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect]       = useState<Rect | null>(null)
  const [navigating, setNav]  = useState(false)

  const steps   = role === "rep" ? REP_STEPS : MANAGER_STEPS
  const step    = steps[stepIdx]
  const total   = steps.length
  const isLast  = stepIdx === total - 1
  const isCentered = step?.selector === null

  // ── Boot ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isDemo) return
    if (ss(SK_DISMISSED) === "1") return
    const savedRole = ss(SK_ROLE) as TourRole | null
    const savedStep = ss(SK_STEP)
    if (savedRole) {
      setRole(savedRole)
      setStepIdx(savedStep ? parseInt(savedStep, 10) : 0)
      setPhase("active")
    } else {
      setPhase("picker")
    }
  }, [isDemo])

  // ── Restart button listener ───────────────────────────────────────────────────

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("[data-action='restart-sales-tour']")) {
        ssSet(SK_DISMISSED, "")
        ssSet(SK_ROLE, "")
        ssSet(SK_STEP, "")
        setStepIdx(0)
        setRect(null)
        setPhase("picker")
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  // ── Navigate to step path ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "active" || !step) return
    if (pathname === step.path) { setNav(false); return }
    setNav(true)
    router.push(step.path)
  }, [phase, stepIdx, role]) // eslint-disable-line

  useEffect(() => {
    if (step && pathname === step.path) setNav(false)
  }, [pathname]) // eslint-disable-line

  // ── Find spotlight rect ───────────────────────────────────────────────────────

  useEffect(() => {
    setRect(null)
    if (phase !== "active" || !step || navigating || !step.selector) return
    let cancelled = false
    waitForEl(step.selector).then(el => {
      if (cancelled || !el) return
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      setTimeout(() => {
        if (cancelled || !el) return
        setRect(getRect(el))
      }, 400)
    })
    return () => { cancelled = true }
  }, [phase, stepIdx, role, navigating]) // eslint-disable-line

  // ── Keep rect synced on scroll/resize ────────────────────────────────────────

  useEffect(() => {
    if (!step?.selector) return
    function update() {
      const el = document.querySelector(step!.selector!)
      if (el) setRect(getRect(el))
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [step?.selector]) // eslint-disable-line

  // ── Actions ───────────────────────────────────────────────────────────────────

  const selectRole = useCallback((r: TourRole) => {
    ssSet(SK_ROLE, r)
    ssSet(SK_STEP, "0")
    setRole(r)
    setStepIdx(0)
    setRect(null)
    setPhase("active")
  }, [])

  const dismiss = useCallback(() => {
    ssSet(SK_DISMISSED, "1")
    setPhase("hidden")
    setRect(null)
  }, [])

  const prev = useCallback(() => {
    if (stepIdx === 0) return
    const n = stepIdx - 1
    setStepIdx(n)
    ssSet(SK_STEP, String(n))
    setRect(null)
  }, [stepIdx])

  const next = useCallback(() => {
    if (isLast) { dismiss(); return }
    const n = stepIdx + 1
    setStepIdx(n)
    ssSet(SK_STEP, String(n))
    setRect(null)
  }, [stepIdx, isLast, dismiss])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "hidden") dismiss()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [phase, dismiss])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!isDemo || phase === "hidden") return null

  if (phase === "picker") {
    return <RolePicker defaultRole={defaultRole} onSelect={selectRole} onSkip={dismiss} />
  }

  if (!step) return null

  const card = (
    <div className="bg-[#0d1117] border border-gray-700/80 rounded-2xl shadow-2xl overflow-hidden">
      {/* Progress */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium shrink-0">
            Step {stepIdx + 1} of {total}
          </span>
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${((stepIdx + 1) / total) * 100}%`,
                background: role === "manager" ? "rgb(59,130,246)" : "rgb(16,185,129)",
              }}
            />
          </div>
          <button
            onClick={dismiss}
            className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 shrink-0"
            title="Skip tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        <h3 className="text-[15px] font-bold text-white mb-2 leading-snug">{step.title}</h3>
        {navigating ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
            <svg className="w-4 h-4 animate-spin text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Navigating…
          </div>
        ) : (
          <p className="text-sm text-gray-400 leading-relaxed">{step.body}</p>
        )}
      </div>

      {/* Nav */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={prev}
          disabled={stepIdx === 0 || navigating}
          className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 text-sm rounded-xl transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1" />
        <button
          onClick={dismiss}
          className="px-3 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={next}
          disabled={navigating}
          className={`flex items-center gap-1 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
            isLast
              ? "bg-emerald-600 hover:bg-emerald-500"
              : role === "manager"
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {isLast
            ? (role === "manager" ? "Go to Manager Dashboard" : "Start Exploring")
            : <><span>Next</span><ChevronRight className="w-4 h-4" /></>
          }
        </button>
      </div>
    </div>
  )

  // Centered overlay (welcome / completion)
  if (isCentered) {
    return (
      <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-gray-950/70 backdrop-blur-sm p-4">
        <div style={{ width: CARD_W }}>{card}</div>
      </div>
    )
  }

  // Spotlight + positioned card
  const pos = rect ? cardPos(rect) : fallbackPos()

  return (
    <>
      {/* Dim overlay */}
      <div className="fixed inset-0 z-[9099] pointer-events-none bg-black/25" />
      {/* Dismiss backdrop */}
      <div className="fixed inset-0 z-[9099]" onClick={dismiss} />

      {/* Spotlight ring */}
      {rect && (
        <div
          className="fixed pointer-events-none z-[9100]"
          style={{
            top:    rect.top  - 6,
            left:   rect.left - 6,
            width:  rect.width  + 12,
            height: rect.height + 12,
            borderRadius: 10,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.25), 0 0 0 2px ${role === "manager" ? "rgba(59,130,246,0.75)" : "rgba(16,185,129,0.75)"}`,
          }}
        />
      )}

      {/* Tooltip card */}
      <div className="fixed z-[9101]" style={pos}>
        {card}
      </div>
    </>
  )
}
