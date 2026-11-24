"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { HelpCircleIcon, BookOpenIcon, LightbulbIcon, BugIcon, MessageSquareIcon, CogIcon } from "@/components/ui/icons"
import { FeedbackDialog } from "./feedback-dialog"
import { TutorialPicker } from "./tutorial-picker"

// Persistent header help control. A question-mark button opens a small menu:
// Help Center, Guided Tutorials, Report a Bug, Request a Feature — plus a
// management-only link to review submitted feedback.
type Overlay = null | "tutorials" | "bug" | "feature"

export function HelpMenu({ isPlatformAdmin = false }: { isPlatformAdmin?: boolean }) {
  const [open, setOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey) }
  }, [open])

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Help & feedback"
        aria-label="Help and feedback"
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <HelpCircleIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Link href="/help" onClick={() => setOpen(false)} className={item}>
            <BookOpenIcon className="h-4 w-4 text-slate-400" /> Help Center
          </Link>
          <button className={item} onClick={() => { setOpen(false); setOverlay("tutorials") }}>
            <LightbulbIcon className="h-4 w-4 text-slate-400" /> Guided tutorials
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button className={item} onClick={() => { setOpen(false); setOverlay("bug") }}>
            <BugIcon className="h-4 w-4 text-slate-400" /> Report a bug
          </button>
          <button className={item} onClick={() => { setOpen(false); setOverlay("feature") }}>
            <MessageSquareIcon className="h-4 w-4 text-slate-400" /> Request a feature
          </button>
          {isPlatformAdmin ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              <Link href="/platform" onClick={() => setOpen(false)} className={item}>
                <CogIcon className="h-4 w-4 text-slate-400" /> Super Admin portal
              </Link>
              <Link href="/feedback" onClick={() => setOpen(false)} className={item}>
                <MessageSquareIcon className="h-4 w-4 text-slate-400" /> Product feedback console
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      {overlay === "tutorials" ? <TutorialPicker onClose={() => setOverlay(null)} /> : null}
      {overlay === "bug" ? <FeedbackDialog mode="BUG" onClose={() => setOverlay(null)} /> : null}
      {overlay === "feature" ? <FeedbackDialog mode="FEATURE" onClose={() => setOverlay(null)} /> : null}
    </div>
  )
}
