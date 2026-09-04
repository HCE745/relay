"use client"

import { useState } from "react"
import { CheckCircle, Loader2, Star } from "lucide-react"

interface Question {
  id:       string
  type:     string
  text:     string
  required: boolean
  options:  string[] | null
  order:    number
}

interface Props {
  surveyId:    string
  title:       string
  description: string | null
  isAnonymous: boolean
  questions:   Question[]
}

type AnswerValue = {
  ratingValue?: number
  boolValue?: boolean
  choiceValue?: string
  textValue?: string
}

export function SurveyTaker({ surveyId, title, description, isAnonymous, questions }: Props) {
  const [answers, setAnswers]   = useState<Record<string, AnswerValue>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState("")
  const [hovered, setHovered]   = useState<Record<string, number>>({})

  function setAnswer(qid: string, patch: AnswerValue) {
    setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], ...patch } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate required
    for (const q of questions) {
      if (!q.required) continue
      const a = answers[q.id]
      const ok =
        (q.type === "RATING"          && a?.ratingValue != null) ||
        (q.type === "YES_NO"          && a?.boolValue   != null) ||
        (q.type === "MULTIPLE_CHOICE" && a?.choiceValue?.trim()) ||
        (q.type === "FREE_TEXT"       && a?.textValue?.trim())
      if (!ok) { setError(`Please answer: "${q.text}"`); return }
    }

    setError("")
    setSubmitting(true)

    try {
      const payload = {
        answers: questions.map(q => ({
          questionId:  q.id,
          ratingValue: answers[q.id]?.ratingValue ?? undefined,
          boolValue:   answers[q.id]?.boolValue   ?? undefined,
          choiceValue: answers[q.id]?.choiceValue  ?? undefined,
          textValue:   answers[q.id]?.textValue    ?? undefined,
        })),
      }

      const res = await fetch(`/api/surveys/${surveyId}/responses`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })

      if (res.ok) {
        setDone(true)
      } else {
        const d = await res.json()
        setError(d.error ?? "Failed to submit")
      }
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank you!</h3>
        <p className="text-gray-500 text-sm max-w-sm">
          Your response has been submitted{isAnonymous ? " anonymously" : ""}. Your feedback helps make things better.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        {isAnonymous && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />
            Your response is anonymous
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-900 mb-3">
              <span className="text-gray-400 mr-1.5">{idx + 1}.</span>
              {q.text}
              {q.required && <span className="text-red-400 ml-1">*</span>}
            </p>

            {/* RATING */}
            {q.type === "RATING" && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => {
                  const selected = answers[q.id]?.ratingValue ?? 0
                  const hover    = hovered[q.id] ?? 0
                  const active   = hover > 0 ? v <= hover : v <= selected
                  return (
                    <button
                      key={v}
                      type="button"
                      onMouseEnter={() => setHovered(h => ({ ...h, [q.id]: v }))}
                      onMouseLeave={() => setHovered(h => ({ ...h, [q.id]: 0 }))}
                      onClick={() => setAnswer(q.id, { ratingValue: v })}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${active ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
                      />
                    </button>
                  )
                })}
                {(answers[q.id]?.ratingValue ?? 0) > 0 && (
                  <span className="self-center text-sm text-gray-500 ml-1">
                    {answers[q.id]?.ratingValue}/5
                  </span>
                )}
              </div>
            )}

            {/* YES_NO */}
            {q.type === "YES_NO" && (
              <div className="flex gap-3">
                {[true, false].map(val => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setAnswer(q.id, { boolValue: val })}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      answers[q.id]?.boolValue === val
                        ? val ? "bg-green-50 border-green-400 text-green-700" : "bg-red-50 border-red-400 text-red-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            )}

            {/* MULTIPLE_CHOICE */}
            {q.type === "MULTIPLE_CHOICE" && (
              <div className="space-y-2">
                {(q.options ?? []).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswer(q.id, { choiceValue: opt })}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      answers[q.id]?.choiceValue === opt
                        ? "bg-blue-50 border-blue-400 text-blue-800"
                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                      answers[q.id]?.choiceValue === opt ? "border-blue-500 bg-blue-500" : "border-gray-300"
                    }`}>
                      {answers[q.id]?.choiceValue === opt && (
                        <span className="block w-1.5 h-1.5 rounded-full bg-white m-auto mt-[3px]" />
                      )}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* FREE_TEXT */}
            {q.type === "FREE_TEXT" && (
              <textarea
                value={answers[q.id]?.textValue ?? ""}
                onChange={e => setAnswer(q.id, { textValue: e.target.value })}
                rows={3}
                placeholder="Your response…"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {submitting ? "Submitting…" : "Submit Response"}
      </button>
    </form>
  )
}
