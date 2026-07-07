"use client"

import { useState } from "react"
import { FileText, ChevronDown, X } from "lucide-react"
import { ISSUE_CATEGORY, ISSUE_PRIORITY } from "@/lib/constants"

interface Template {
  id: string
  name: string
  category: string | null
  priority: string | null
  descriptionTemplate: string | null
}

interface Props {
  templates: Template[]
  onApply: (t: Template) => void
}

export function TemplatePicker({ templates, onApply }: Props) {
  const [open, setOpen] = useState(false)

  if (!templates.length) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Use template
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-20 bg-white rounded-xl border border-gray-200 shadow-lg w-72 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Templates</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
            </div>
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onApply(t); setOpen(false) }}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    {t.category && <span className="text-xs text-gray-400">{ISSUE_CATEGORY[t.category as keyof typeof ISSUE_CATEGORY] ?? t.category}</span>}
                    {t.priority && <span className="text-xs text-gray-400">· {ISSUE_PRIORITY[t.priority as keyof typeof ISSUE_PRIORITY] ?? t.priority}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
