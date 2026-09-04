"use client"

import { useState } from "react"
import { Link2, Check } from "lucide-react"

interface Props {
  url: string
  className?: string
}

export function CopyLink({ url, className = "" }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy link"}
      className={`inline-flex items-center gap-1 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs text-green-600 font-medium">Copied!</span>
        </>
      ) : (
        <Link2 className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
