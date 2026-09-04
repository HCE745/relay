"use client"

import { useState } from "react"
import { Copy, Mail, CheckCircle2 } from "lucide-react"

interface ReferralShareSectionProps {
  referralLink: string
  ctaLabel?: string
}

export function ReferralShareSection({ referralLink, ctaLabel = "Copy Referral Link" }: ReferralShareSectionProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  function shareByEmail() {
    const subject = encodeURIComponent("Try Relay — I think you'd love it")
    const body = encodeURIComponent(
      `Hi,\n\nI've been using Relay to manage operations and thought you might find it useful too.\n\nSign up with my referral link and we both get a reward:\n${referralLink}\n\nCheers`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 flex items-center min-w-0">
        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{referralLink}</span>
      </div>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0 whitespace-nowrap"
      >
        {copied
          ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</>
          : <><Copy className="w-3.5 h-3.5" /> {ctaLabel}</>
        }
      </button>
      <button
        onClick={shareByEmail}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
      >
        <Mail className="w-3.5 h-3.5" />
        Email
      </button>
    </div>
  )
}
