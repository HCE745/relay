"use client"

import { useState } from "react"
import { Calendar, Copy, Check, ExternalLink } from "lucide-react"

export function CrmSchedulingButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-l-lg transition-colors"
      >
        <Calendar className="w-4 h-4" />
        Schedule Demo
        <ExternalLink className="w-3 h-3 opacity-70" />
      </a>
      <button
        onClick={copyLink}
        title="Copy booking link"
        className="flex items-center justify-center px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-r-lg transition-colors border-l border-indigo-500"
      >
        {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

export function CrmSchedulingButtonFallback() {
  return (
    <a
      href="/book-demo"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <Calendar className="w-4 h-4" />
      Schedule Demo
    </a>
  )
}
