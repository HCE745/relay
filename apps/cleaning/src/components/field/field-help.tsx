"use client"

import { useState } from "react"
import { HelpCircleIcon } from "@/components/ui/icons"
import { FeedbackDialog } from "@/components/help/feedback-dialog"

// Field help control (header "?"). Cleaners get bug/feature reporting with the
// same in-browser capture + consent as the admin app. Guided tutorials are
// admin-only (they navigate management screens), so they're not offered here.
export function FieldHelp() {
  const [open, setOpen] = useState(false)
  const [overlay, setOverlay] = useState<null | "BUG" | "FEATURE">(null)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Help and feedback"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <HelpCircleIcon className="h-5 w-5" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
            <button className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setOpen(false); setOverlay("BUG") }}>Report a problem</button>
            <button className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setOpen(false); setOverlay("FEATURE") }}>Suggest an improvement</button>
          </div>
        </>
      ) : null}
      {overlay ? <FeedbackDialog mode={overlay} onClose={() => setOverlay(null)} /> : null}
    </div>
  )
}
