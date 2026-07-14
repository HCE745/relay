"use client"

import { useState } from "react"
import Link from "next/link"
import { Gift, Copy, Mail, ChevronRight, CheckCircle2 } from "lucide-react"

interface ReferralCardProps {
  referralCode:   string | null
  referralLink:   string | null
  cardTitle:      string
  cardDescription: string
  stats: {
    submitted:    number
    qualified:    number
    pending:      number
    creditsEarned: number
  }
}

export function ReferralCard({
  referralCode, referralLink, cardTitle, cardDescription, stats,
}: ReferralCardProps) {
  const [copied, setCopied] = useState(false)

  const link = referralLink ?? `https://app.getrelay.software/signup?ref=${referralCode}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  function shareByEmail() {
    const subject = encodeURIComponent("Try Relay — I think you'd love it")
    const body = encodeURIComponent(
      `Hi,\n\nI've been using Relay to manage operations and thought you might find it useful too.\n\nSign up with my referral link and we both get a reward:\n${link}\n\nCheers`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{cardTitle}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">{cardDescription}</p>
            </div>
          </div>
          <Link
            href="/referrals"
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 mt-0.5"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {[
            { label: "Submitted",  value: stats.submitted },
            { label: "Qualified",  value: stats.qualified },
            { label: "Pending",    value: stats.pending },
            { label: "Credits",    value: stats.creditsEarned > 0 ? `${stats.creditsEarned} mo` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Referral link */}
        {referralCode && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{link}</span>
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={shareByEmail}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
