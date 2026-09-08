"use client"

import { useState } from "react"
import { Star, CheckCircle, AlertCircle } from "lucide-react"

interface Question {
  id: string
  type: string
  text: string
  required?: boolean
  options?: string[]
}

interface Props {
  surveyToken: string
  title: string
  description: string | null
  questions: Question[]
  isAnonymous: boolean
  orgName: string
  orgLogo: string | null
  locationName: string | null
}

export function SurveyForm({
  surveyToken,
  title,
  description,
  questions,
  isAnonymous,
  orgName,
  orgLogo,
  locationName,
}: Props) {
  const [answers, setAnswers]         = useState<Record<string, unknown>>({})
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [hovered, setHovered]         = useState<Record<string, number>>({})
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState("")

  function setAnswer(qId: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    for (const q of questions) {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === "")) {
        setError(`Please answer: "${q.text}"`)
        return
      }
    }
    setSubmitting(true); setError("")
    try {
      const res = await fetch(`/api/survey/${surveyToken}/respond`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          answers,
          customerName:  isAnonymous ? undefined : customerName.trim() || undefined,
          customerEmail: isAnonymous ? undefined : customerEmail.trim() || undefined,
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        <div className="bg-blue-600 px-6 py-8">
          {orgLogo && (
            <img src={orgLogo} alt={orgName} className="w-14 h-14 rounded-xl mb-3 bg-white object-contain p-1" />
          )}
          <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">{orgName}{locationName ? ` · ${locationName}` : ""}</p>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {description && <p className="text-blue-100 text-sm mt-2">{description}</p>}
        </div>

        {done ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
            <p className="text-gray-500 text-sm">Your responses have been recorded.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-8 space-y-8">
            {questions.map(q => (
              <div key={q.id}>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  {q.text}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {q.type === "RATING" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => {
                      const active = (hovered[q.id] ?? 0) || (answers[q.id] as number ?? 0)
                      return (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHovered(h => ({ ...h, [q.id]: n }))}
                          onMouseLeave={() => setHovered(h => ({ ...h, [q.id]: 0 }))}
                          onClick={() => setAnswer(q.id, n)}
                          className="focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star
                            className="w-9 h-9"
                            fill={n <= active ? "#FBBF24" : "none"}
                            stroke={n <= active ? "#F59E0B" : "#D1D5DB"}
                          />
                        </button>
                      )
                    })}
                  </div>
                )}

                {q.type === "NPS" && (
                  <div>
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: 11 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAnswer(q.id, i)}
                          className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                            answers[q.id] === i
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>Not at all likely</span>
                      <span>Extremely likely</span>
                    </div>
                  </div>
                )}

                {q.type === "YES_NO" && (
                  <div className="flex gap-3">
                    {["Yes", "No"].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          answers[q.id] === opt
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "MULTIPLE_CHOICE" && q.options && (
                  <div className="space-y-2">
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-colors ${
                          answers[q.id] === opt
                            ? "bg-blue-50 border-blue-500 text-blue-800 font-medium"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "TEXT" && (
                  <textarea
                    value={(answers[q.id] as string) ?? ""}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    rows={3}
                    placeholder="Your answer…"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                )}
              </div>
            ))}

            {!isAnonymous && (
              <div className="pt-2 border-t border-gray-100 space-y-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Your details (optional)</p>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

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
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </form>
        )}
      </div>
      <p className="mt-6 text-xs text-gray-400">Powered by Relay</p>
    </div>
  )
}
