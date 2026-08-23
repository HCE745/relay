"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Trash2, GripVertical, Star, ToggleLeft, List, AlignLeft,
  Loader2, CheckCircle, X,
} from "lucide-react"

export type QuestionType = "RATING" | "YES_NO" | "MULTIPLE_CHOICE" | "FREE_TEXT"

interface Question {
  id:       string
  type:     QuestionType
  text:     string
  required: boolean
  options:  string[]
}

const TYPE_LABEL: Record<QuestionType, string> = {
  RATING:          "Rating (1–5 stars)",
  YES_NO:          "Yes / No",
  MULTIPLE_CHOICE: "Multiple Choice",
  FREE_TEXT:       "Free Text",
}

const TYPE_ICON: Record<QuestionType, React.ElementType> = {
  RATING:          Star,
  YES_NO:          ToggleLeft,
  MULTIPLE_CHOICE: List,
  FREE_TEXT:       AlignLeft,
}

function uid() { return Math.random().toString(36).slice(2) }

function newQuestion(): Question {
  return { id: uid(), type: "RATING", text: "", required: true, options: [] }
}

interface Props {
  initialSurveyId?: string
}

export function SurveyBuilder({ initialSurveyId }: Props) {
  const router = useRouter()
  const [title, setTitle]           = useState("")
  const [description, setDesc]      = useState("")
  const [isAnonymous, setAnonymous] = useState(true)
  const [questions, setQuestions]   = useState<Question[]>([newQuestion()])
  const [saving, setSaving]         = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError]           = useState("")
  const [savedId, setSavedId]       = useState(initialSurveyId ?? "")

  function addQuestion() {
    setQuestions(qs => [...qs, newQuestion()])
  }

  function removeQuestion(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  function addOption(qid: string) {
    setQuestions(qs => qs.map(q => q.id === qid ? { ...q, options: [...q.options, ""] } : q))
  }

  function updateOption(qid: string, idx: number, val: string) {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q
      const opts = [...q.options]
      opts[idx] = val
      return { ...q, options: opts }
    }))
  }

  function removeOption(qid: string, idx: number) {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qid) return q
      return { ...q, options: q.options.filter((_, i) => i !== idx) }
    }))
  }

  function moveQuestion(fromIdx: number, toIdx: number) {
    setQuestions(qs => {
      const next = [...qs]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  async function save(publish = false) {
    if (!title.trim()) { setError("Survey title is required"); return }
    const invalid = questions.find(q => !q.text.trim())
    if (invalid) { setError("All questions must have text"); return }
    const mcInvalid = questions.find(q => q.type === "MULTIPLE_CHOICE" && q.options.filter(o => o.trim()).length < 2)
    if (mcInvalid) { setError("Multiple Choice questions need at least 2 options"); return }

    setError("")
    if (publish) setPublishing(true); else setSaving(true)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        isAnonymous,
        questions: questions.map(q => ({
          type:     q.type,
          text:     q.text.trim(),
          required: q.required,
          options:  q.type === "MULTIPLE_CHOICE" ? q.options.filter(o => o.trim()) : undefined,
        })),
      }

      let id = savedId
      if (!id) {
        // Create
        const res = await fetch("/api/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return }
        const data = await res.json()
        id = data.id
        setSavedId(id)
      } else {
        // Update
        const res = await fetch(`/api/surveys/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to update"); return }
      }

      if (publish) {
        const res = await fetch(`/api/surveys/${id}/publish`, { method: "POST" })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to publish"); return }
        router.push("/surveys/manage")
        router.refresh()
      }
    } finally {
      setSaving(false)
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Survey meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Survey Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Monthly Pulse Check"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            placeholder="Briefly describe the purpose of this survey…"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAnonymous(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAnonymous ? "bg-blue-600" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isAnonymous ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm text-gray-700">
            Anonymous responses {isAnonymous ? <span className="text-gray-400">(respondents won&apos;t be identified)</span> : <span className="text-gray-400">(respondent names recorded)</span>}
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const Icon = TYPE_ICON[q.type]
          return (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-2 cursor-grab text-gray-300 hover:text-gray-500"
                  title="Drag to reorder"
                  onClick={() => idx > 0 && moveQuestion(idx, idx - 1)}
                >
                  <GripVertical className="w-4 h-4" />
                </button>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-500">Q{idx + 1}</span>
                    {/* Type selector */}
                    <div className="flex gap-1 flex-wrap">
                      {(Object.keys(TYPE_LABEL) as QuestionType[]).map(t => {
                        const TIcon = TYPE_ICON[t]
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateQuestion(q.id, { type: t, options: [] })}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
                              q.type === t
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            <TIcon className="w-3 h-3" />
                            {TYPE_LABEL[t]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <input
                    value={q.text}
                    onChange={e => updateQuestion(q.id, { text: e.target.value })}
                    placeholder="Question text…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Multiple choice options */}
                  {q.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-2 pl-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />
                          <input
                            value={opt}
                            onChange={e => updateOption(q.id, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={() => removeOption(q.id, oi)} className="text-gray-300 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Plus className="w-3 h-3" /> Add option
                      </button>
                    </div>
                  )}

                  {/* Rating preview */}
                  {q.type === "RATING" && (
                    <div className="flex gap-1 pl-1">
                      {[1, 2, 3, 4, 5].map(v => (
                        <Star key={v} className="w-5 h-5 text-gray-200" />
                      ))}
                      <span className="text-xs text-gray-400 ml-1 self-center">1 – 5 stars</span>
                    </div>
                  )}

                  {/* Required toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      id={`req-${q.id}`}
                      type="checkbox"
                      checked={q.required}
                      onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`req-${q.id}`} className="text-xs text-gray-500">Required</label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  disabled={questions.length === 1}
                  className="mt-1 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving || publishing}
          className="flex items-center gap-2 px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving || publishing}
          className="flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Publish Survey
        </button>
      </div>
    </div>
  )
}
