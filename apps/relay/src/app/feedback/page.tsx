"use client"

import { useState } from "react"
import Link from "next/link"
import { Send, CheckCircle, Loader2, AlertCircle } from "lucide-react"
import { RelayWordmark } from "@/components/logo"

const FEEDBACK_TYPES = [
  { value: "feature_request",     label: "Feature Request",     desc: "I want a new feature" },
  { value: "product_feedback",    label: "Product Feedback",    desc: "General thoughts on how Relay works" },
  { value: "ui_ux_suggestion",    label: "UI/UX Suggestion",    desc: "Something about the design or usability" },
  { value: "integration_request", label: "Integration Request", desc: "Connect Relay with another tool" },
  { value: "pricing_feedback",    label: "Pricing Feedback",    desc: "Thoughts on pricing or plans" },
  { value: "general_suggestion",  label: "General Suggestion",  desc: "Anything else" },
] as const

type FeedbackTypeValue = typeof FEEDBACK_TYPES[number]["value"]

const MAIN_PLACEHOLDER: Record<FeedbackTypeValue, string> = {
  feature_request:     "What would you like Relay to do?",
  product_feedback:    "Share your thoughts on how Relay works…",
  ui_ux_suggestion:    "What about the design or usability would you change?",
  integration_request: "Which tool, and what would the integration do?",
  pricing_feedback:    "Share your thoughts on pricing or plans…",
  general_suggestion:  "Share any idea or suggestion…",
}

export default function PublicFeedbackPage() {
  const [feedbackType, setFeedbackType] = useState<FeedbackTypeValue>("product_feedback")
  const [description,  setDescription]  = useState("")
  const [name,         setName]         = useState("")
  const [email,        setEmail]        = useState("")
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [error,        setError]        = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !name.trim() || !email.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/feedback", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackType,
          description: description.trim(),
          name:  name.trim(),
          email: email.trim(),
        }),
      })
      const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(j.error ?? "Failed to submit. Please try again.")
        return
      }
      setSubmitted(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thanks for your feedback!</h1>
          <p className="text-gray-500 text-sm mb-8">
            We read every submission and use it to make Relay better. We may follow up if we have questions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => { setSubmitted(false); setDescription(""); setName(""); setEmail("") }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Submit another
            </button>
            <span className="text-gray-300 hidden sm:block">·</span>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              Back to Relay
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <RelayWordmark height={36} />
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Share Feedback</h1>
          <p className="text-gray-500 text-sm mb-6">
            Have ideas, suggestions, or thoughts on Relay? We&apos;d love to hear them.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                What kind of feedback?
              </label>
              <select
                value={feedbackType}
                onChange={e => { setFeedbackType(e.target.value as FeedbackTypeValue); setDescription("") }}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {FEEDBACK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                ))}
              </select>
            </div>

            {/* Main feedback text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Your feedback <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                placeholder={MAIN_PLACEHOLDER[feedbackType]}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                required
              />
            </div>

            {/* Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Your name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !description.trim() || !name.trim() || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Send className="w-4 h-4" /> Send Feedback</>
              }
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-400">
            Already a Relay customer?{" "}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign in
            </Link>{" "}
            to share feedback from inside the app.
          </p>
        </div>
      </div>
    </div>
  )
}
