"use client"

import { useState } from "react"
import { MapPin, Star } from "lucide-react"

interface FeedbackQrCode {
  id:           string
  token:        string
  name:         string
  description:  string | null
  area:         string | null
  location:     { id: string; name: string } | null
  organization: { id: string; name: string }
  menuUrl:      string | null
}

export function QrFeedbackForm({ qrCode }: { qrCode: FeedbackQrCode }) {
  const [rating,    setRating]    = useState(0)
  const [hovered,   setHovered]   = useState(0)
  const [comment,   setComment]   = useState("")
  const [name,      setName]      = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]     = useState("")
  const [submitted, setSubmitted] = useState(false)

  const locationStr = [qrCode.location?.name, qrCode.area].filter(Boolean).join(" · ")
  const displayRating = hovered || rating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!rating) { setError("Please select a star rating"); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/report/${qrCode.token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null, name: name.trim() || null }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Something went wrong. Please try again.")
        return
      }
      setSubmitted(true)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Thanks for your feedback!</h1>
          <p className="text-gray-600 mb-1">Your response has been recorded.</p>
          <p className="text-sm text-gray-400">{qrCode.organization.name} appreciates hearing from you.</p>
          {qrCode.menuUrl && (
            <a href={qrCode.menuUrl} className="mt-6 inline-block text-sm text-indigo-600">
              ← Back to menu
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {qrCode.menuUrl && (
            <a href={qrCode.menuUrl} className="inline-flex items-center gap-1 text-xs text-indigo-600 mb-2">
              ← Back
            </a>
          )}
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">{qrCode.organization.name}</p>
          <h1 className="text-xl font-bold text-gray-900">{qrCode.name}</h1>
          {locationStr && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {locationStr}
            </p>
          )}
          {qrCode.description && (
            <p className="text-sm text-gray-400 mt-2">{qrCode.description}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Star rating */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-4 text-center">
            How was your experience? <span className="text-red-500">*</span>
          </p>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="focus:outline-none transition-transform active:scale-90"
                aria-label={`${star} star${star !== 1 ? "s" : ""}`}
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= displayRating
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-gray-200 fill-gray-200"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-500 mt-3">
              {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Comments <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Tell us more about your experience…"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Your name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name or anonymous"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !rating}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {submitting ? "Submitting…" : "Submit Feedback"}
        </button>

        <p className="text-xs text-gray-400 text-center pb-6">
          Your feedback is shared with {qrCode.organization.name}.
        </p>
      </form>
    </div>
  )
}
