"use client"

import { useState } from "react"
import { Phone } from "lucide-react"
import { LogCallModal } from "@/components/crm/LogCallModal"

export function ProspectCallButton({ prospectId }: { prospectId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Phone className="w-3.5 h-3.5" />
        Log Call
      </button>
      {open && <LogCallModal prospectId={prospectId} onClose={() => setOpen(false)} />}
    </>
  )
}
