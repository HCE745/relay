"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, GripVertical, AlertCircle } from "lucide-react"

const QUESTION_TYPES = [
  { value: "RATING",          label: "Star Rating (1–5)" },
  { value: "NPS",             label: "NPS Score (0–10)" },
  { value: "TEXT",            label: "Open Text" },
  { value: "YES_NO",          label: "Yes / No" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
]

interface Question {
  id: string
  type: string
  text: string
  required: boolean
  options: string[]
}

interface Location { id: string; name: string }

function uid() { return Math.random().toString(36).slice(2, 10) }

export function SurveyBuilder({ locations }: { locations: Location[] }) {
  const router = useRouter()
  const [title, setTitle]           = useState("")
  const [description, setDescription] = useState("")
  const [locationId, setLocationId] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [questions, setQuestions]   = useState<Question[]>([
    { id: uid(), type: "RATING", text: "How would you rate your overall experience?", required: true, options: [] },
  ])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")

  function addQuestion() {
    setQuestions(qs => [...qs, { id: uid(), type: "TEXT", text: "", required: false, options: [] }])
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  function removeQuestion(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  function addOption(qId: string) {
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, options: [...q.options, ""] } : q))
  }

  function updateOption(qId: string, idx: number, val: string) {
    setQuestions(qs => qs.map(q => q.id === qId
      ? { ...q, options: q.options.map((o, i) => i === idx ? val : o) }
      : q))
  }

  function removeOption(qId: string, idx: number) {
    setQuestions(qs => qs.map(q => q.id === qId
      ? { ...q, options: q.options.filter((_, i) => i !== idx) }
      : q))
  }

  async function save(status: "DRAFT" | "ACTIVE") {
    if (!title.trim()) { setError("Survey title is required"); return }
    if (questions.some(q => !q.text.trim())) { setError("All questions must have text"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/customer-voice/surveys", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:       title.trim(),
          description: description.trim() || null,
          locationId:  locationId || null,
          isAnonymous,
          questions,
          status,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Save failed")
      }
      router.push("/customer-voice/surveys")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Survey details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Survey Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. How was your visit?"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A brief intro shown to respondents"
            rows={2}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        {locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location <span className="text-gray-400 font-normal">(optional)</span></label>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={e => setIsAnonymous(e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">Anonymous — don&apos;t ask for name or email</span>
        </label>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Questions</h2>
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <GripVertical className="w-5 h-5 text-gray-300 mt-2 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateQuestion(q.id, { text: e.target.value })}
                    placeholder={`Question ${idx + 1}`}
                    className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(q.id, { type: e.target.value, options: [] })}
                    className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {q.type === "MULTIPLE_CHOICE" && (
                  <div className="space-y-2 pl-1">
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={e => updateOption(q.id, i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => removeOption(q.id, i)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(q.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + Add option
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    disabled={questions.length === 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-blue-400 text-sm text-gray-500 hover:text-blue-600 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => save("DRAFT")}
          disabled={saving}
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-sm font-semibold text-gray-700 rounded-xl transition-colors disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={() => save("ACTIVE")}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-sm font-semibold text-white rounded-xl transition-colors"
        >
          {saving ? "Saving…" : "Publish Survey"}
        </button>
      </div>
    </div>
  )
}
