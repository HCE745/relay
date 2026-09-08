"use client"

import { useState } from "react"
import { Star, CheckCircle, AlertCircle } from "lucide-react"

interface Props {
  orgSlug: string
  orgName: string
  orgLogo: string | null
  locationSlug: string | null
  locationName: string | null
}

export function FeedbackForm({ orgSlug, orgName, orgLogo, locationSlug, locationName }: Props) {
  const [rating, setRating]           = useState(0)
  const [hovered, setHovered]         = useState(0)
  const [feedbackText, setFeedbackText] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setError("Please select a star rating"); return }
    setSubmitting(true); setError("")
    try {
      const res = await fetch(`/api/feedback/${orgSlug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          rating,
          feedbackText: feedbackText.trim() || null,
          customerName: customerName.trim() || null,
          customerEmail: customerEmail.trim() || null,
          locationSlug: locationSlug || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Submission failed")
      }
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const active = hovered || rating

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 px-6 py-8 text-center">
          {orgLogo && (
            <img src={orgLogo} alt={orgName} className="w-16 h-16 rounded-xl mx-auto mb-3 bg-white object-contain p-1" />
          )}
          <h1 className="text-xl font-bold text-white">{orgName}</h1>
          {locationName && (
            <p className="text-blue-100 text-sm mt-1">{locationName}</p>
          )}
          <p className="text-blue-100 text-sm mt-2">
            We&apos;d love to hear about your experience
          </p>
        </div>

        {done ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
            <p className="text-gray-500 text-sm">Your feedback has been received. We appreciate you taking the time.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-8 space-y-6">

            {/* Star rating */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3 text-center">
                How would you rate your experience? <span className="text-red-500">*</span>
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => { setRating(n); setError("") }}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className="w-10 h-10"
                      fill={n <= active ? "#FBBF24" : "none"}
                      stroke={n <= active ? "#F59E0B" : "#D1D5DB"}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  {["", "Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"][rating]}
                </p>
              )}
            </div>

            {/* Feedback text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tell us more <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="What did you like or what could be improved?"
                rows={4}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Your name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Only used if you&apos;d like a follow-up from us.</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors"
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>

          </form>
        )}
      </div>
      <p className="mt-6 text-xs text-gray-400">Powered by Relay</p>
    </div>
  )
}
