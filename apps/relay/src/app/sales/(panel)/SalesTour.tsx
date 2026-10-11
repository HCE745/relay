"use client"

import { useState, useEffect, useCallback } from "react"
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
    title: "Here is how your day works",
    body: "Start on this dashboard every morning. Your action center at the top tells you exactly who to contact today and what needs attention.",
    path: "/sales",
    selector: null,
  },
  {
    title: "Check this first every morning",
    body: "Work through these in order — reply to anyone who responded, then handle overdue follow-ups, then contact prospects who engaged with your tour link.",
    path: "/sales",
    selector: "[data-tour='rep-action-center']",
  },
  {
    title: "This is how you find companies to contact",
    body: "Click Find New Prospects, describe the type of company you are looking for, and the system returns real companies with research already done. Check the badges — companies already in the CRM are marked so you do not contact someone another rep is working.",
    path: "/sales/outreach/prospects",
    selector: "a[href='/sales/outreach/prospects/discover']",
  },
  {
    title: "Read this before every call",
    body: "Open any prospect to see what the AI found — their pain points, why Relay fits them, and what angle to lead with. Use this to personalize your outreach instead of sending a generic email.",
    path: "/sales/outreach/prospects",
    selector: "[data-tour='rep-research-hint']",
  },
  {
    title: "Claim accounts before you contact them",
    body: "When you add a company it is assigned to you. Other reps will see your name on it and cannot contact them without a collision warning. Add the company first, then reach out.",
    path: "/sales/outreach/prospects",
    selector: "[data-tour='rep-research-hint']",
  },
  {
    title: "Send emails from here, not your personal inbox",
    body: "All outreach goes through this email section so your activity is tracked. You can see replies, opens, and link clicks in one place without switching between tools.",
    path: "/sales/outreach/email",
    selector: "[data-tour='rep-link-tracking']",
  },
  {
    title: "Check this before you make a call",
    body: "When a prospect clicks your email link you can see exactly how far they got through the demo and whether they viewed pricing. Prospects who completed the tour are your warmest leads — call them first.",
    path: "/sales/outreach/prospects",
    selector: "[data-tour='rep-research-hint']",
  },
  {
    title: "Work this queue every day",
    body: "This shows everyone who is due for a follow-up today. Click Compose Follow-Up to write a message with their context already loaded. Do not let anything sit in overdue for more than 24 hours.",
    path: "/sales/outreach/follow-ups",
    selector: "[data-tour='rep-stage-system']",
  },
  {
    title: "Update this after every interaction",
    body: "Each prospect shows which follow-up stage they are in. After you send a follow-up the system moves them to the next stage automatically. If you have a call or meeting log it as a note so the record stays current.",
    path: "/sales/outreach/follow-ups",
    selector: "[data-tour='rep-stage-system']",
  },
  {
    title: "These people are interested — contact them today",
    body: "Prospects who clicked your tour link appear here with their engagement score. Sort by engagement to find who spent the most time in the demo. These are your priority calls.",
    path: "/sales/demo-analytics",
    selector: "a[href='/sales/demo-analytics']",
  },
  {
    title: "Never lose track of where you left off",
    body: "Each follow-up shows the last email sent, how many days since contact, and what stage you are in with that prospect. Click Compose Follow-Up and the context is already there.",
    path: "/sales/outreach/follow-ups",
    selector: "[data-tour='rep-stage-system']",
  },
  {
    title: "Move deals here as they progress",
    body: "When a prospect agrees to a discovery call or demo create an opportunity and move it to the right stage. Keep every active deal updated so your manager can see where things stand.",
    path: "/sales/opportunities",
    selector: "a[href='/sales/opportunities']",
  },
  {
    title: "This is how your commission is calculated",
    body: "Every customer you close is linked to your account. When they pay Relay your commission is calculated automatically based on your agreement and shows up here as pending until your manager approves it.",
    path: "/sales/commission",
    selector: "a[href='/sales/commission']",
  },
  {
    title: "That covers your daily workflow",
    body: "Find prospects, claim accounts, send outreach, work your follow-up queue, move deals through the pipeline. Your manager can answer questions about your specific targets and territory.",
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
    title: "Transfer accounts between reps",
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

const CARD_W       = 360
const CARD_H       = 300
const GAP          = 20
const SIDEBAR_W    = 256  // matches w-64 sidebar

function cardPos(rect: Rect): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const elCenterX = rect.left + rect.width  / 2
  const elCenterY = rect.top  + rect.height / 2

  function clampTop(t: number) {
    return Math.max(GAP, Math.min(t, vh - CARD_H - GAP))
  }

  // Sidebar element: always right of the sidebar panel
  if (rect.left < SIDEBAR_W && SIDEBAR_W + GAP + CARD_W <= vw) {
    return {
      position: "fixed",
      top:   clampTop(elCenterY - CARD_H / 2),
      left:  SIDEBAR_W + GAP,
      width: CARD_W,
    }
  }

  // Element in left half of main content → card to the right
  if (elCenterX < vw / 2) {
    const cardLeft = rect.left + rect.width + GAP
    if (cardLeft + CARD_W <= vw) {
      return {
        position: "fixed",
        top:   clampTop(elCenterY - CARD_H / 2),
        left:  cardLeft,
        width: CARD_W,
      }
    }
  }

  // Element in right half of main content → card to the left
  if (elCenterX >= vw / 2) {
    const cardLeft = rect.left - GAP - CARD_W
    if (cardLeft >= GAP) {
      return {
        position: "fixed",
        top:   clampTop(elCenterY - CARD_H / 2),
        left:  cardLeft,
        width: CARD_W,
      }
    }
  }

  // Fallback: above or below, centered on element
  const centeredLeft = Math.max(GAP, Math.min(elCenterX - CARD_W / 2, vw - CARD_W - GAP))

  // Element in top half → card below
  if (elCenterY < vh / 2) {
    return {
      position: "fixed",
      top:   clampTop(rect.top + rect.height + GAP),
      left:  centeredLeft,
      width: CARD_W,
    }
  }

  // Element in bottom half → card above
  return {
    position: "fixed",
    top:   clampTop(rect.top - GAP - CARD_H),
    left:  centeredLeft,
    width: CARD_W,
  }
}

function fallbackPos(): React.CSSProperties {
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280
  const vh = typeof window !== "undefined" ? window.innerHeight : 900
  return {
    position: "fixed",
    top:   Math.max(GAP, vh - CARD_H - 24),
    left:  Math.max(GAP, vw - CARD_W - 24),
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
          <p className="text-sm text-gray-400">Choose your role to see the workflow that applies to you.</p>
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
            <p className="text-[11px] text-gray-600">14 steps · ~5 min</p>
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

  const steps      = role === "rep" ? REP_STEPS : MANAGER_STEPS
  const step       = steps[stepIdx]
  const total      = steps.length
  const isLast     = stepIdx === total - 1
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
