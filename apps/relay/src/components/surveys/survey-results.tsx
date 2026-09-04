"use client"

import { format } from "date-fns"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts"

export interface QuestionResult {
  questionId:   string
  type:         string
  text:         string
  count:        number
  // RATING
  avg?:         number | null
  distribution?: Array<{ value: number; count: number }>
  // YES_NO
  yes?:         number
  no?:          number
  // MULTIPLE_CHOICE
  options?:     Array<{ option: string; count: number }>
  // FREE_TEXT
  responses?:   (string | null)[]
}

interface LongitudinalPoint {
  surveyId:      string
  closedAt:      string
  avg:           number
  responseCount: number
}

interface Props {
  totalResponses: number
  questionResults: QuestionResult[]
  longitudinal:   Record<string, LongitudinalPoint[]>
  closedAt:       string | null
}

const STAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"]
const PIE_COLORS  = ["#22c55e", "#ef4444"]
const BAR_COLOR   = "#3b82f6"

function RatingChart({ result }: { result: QuestionResult }) {
  const data = (result.distribution ?? []).map(d => ({ label: `${d.value}★`, count: d.count, fill: STAR_COLORS[d.value - 1] }))
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl font-bold text-gray-900">{result.avg != null ? result.avg.toFixed(1) : "—"}</div>
        <div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(v => (
              <span key={v} className={`text-lg ${v <= Math.round(result.avg ?? 0) ? "text-amber-400" : "text-gray-200"}`}>★</span>
            ))}
          </div>
          <div className="text-xs text-gray-400">{result.count} response{result.count !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [`${v} response${v !== 1 ? "s" : ""}`, ""]} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function YesNoChart({ result }: { result: QuestionResult }) {
  const yes = result.yes ?? 0
  const no  = result.no  ?? 0
  const total = yes + no
  const data = [
    { name: "Yes", value: yes },
    { name: "No",  value: no },
  ]
  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: PIE_COLORS[i] }} />
            <span className="font-medium text-gray-800">{d.name}</span>
            <span className="text-gray-500">{d.value}</span>
            <span className="text-gray-400 text-xs">({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
          </div>
        ))}
        <div className="text-xs text-gray-400">{total} response{total !== 1 ? "s" : ""}</div>
      </div>
    </div>
  )
}

function MultipleChoiceChart({ result }: { result: QuestionResult }) {
  const data = (result.options ?? []).map(o => ({ option: o.option, count: o.count }))
  const max  = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.option}>
          <div className="flex justify-between text-sm mb-0.5">
            <span className="text-gray-700">{d.option}</span>
            <span className="text-gray-500">{d.count}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400 mt-1">{result.count} response{result.count !== 1 ? "s" : ""}</p>
    </div>
  )
}

function FreeTextList({ result }: { result: QuestionResult }) {
  const texts = (result.responses ?? []).filter(Boolean) as string[]
  if (texts.length === 0) return <p className="text-sm text-gray-400">No responses yet</p>
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {texts.map((t, i) => (
        <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          {t}
        </div>
      ))}
    </div>
  )
}

function LongitudinalSection({ questionText, series }: { questionText: string; series: LongitudinalPoint[] }) {
  const data = series.map(p => ({
    date: format(new Date(p.closedAt), "MMM d"),
    avg:  p.avg,
    n:    p.responseCount,
  }))
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-1">Trend: {questionText}</h4>
      <p className="text-xs text-gray-400 mb-4">Average rating across survey runs</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v, _name, item) => {
              const avg = typeof v === "number" ? v.toFixed(2) : v
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const n = (item?.payload as any)?.n ?? ""
              return [`${avg} avg${n ? ` (${n} responses)` : ""}`, questionText]
            }}
          />
          <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SurveyResults({ totalResponses, questionResults, longitudinal, closedAt }: Props) {
  const ratingQs = questionResults.filter(q => q.type === "RATING")

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{totalResponses}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total Responses</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{questionResults.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Questions</div>
        </div>
        {closedAt && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xl font-bold text-gray-900">{format(new Date(closedAt), "MMM d, yyyy")}</div>
            <div className="text-xs text-gray-400 mt-0.5">Closed</div>
          </div>
        )}
      </div>

      {/* Per-question results */}
      <div className="space-y-4">
        {questionResults.map((r, idx) => (
          <div key={r.questionId} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-900 mb-4">
              <span className="text-gray-400 mr-1">{idx + 1}.</span>
              {r.text}
            </p>
            {r.type === "RATING"          && <RatingChart result={r} />}
            {r.type === "YES_NO"          && <YesNoChart  result={r} />}
            {r.type === "MULTIPLE_CHOICE" && <MultipleChoiceChart result={r} />}
            {r.type === "FREE_TEXT"       && <FreeTextList result={r} />}
            {r.count === 0 && r.type !== "FREE_TEXT" && (
              <p className="text-xs text-gray-400 mt-2">No responses yet</p>
            )}
          </div>
        ))}
      </div>

      {/* Longitudinal charts */}
      {ratingQs.length > 0 && Object.keys(longitudinal).length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Longitudinal Trends</h3>
          <p className="text-sm text-gray-500 mb-4">
            Showing how average ratings changed across survey runs with the same title.
          </p>
          <div className="space-y-4">
            {ratingQs
              .filter(q => longitudinal[q.questionId])
              .map(q => (
                <LongitudinalSection
                  key={q.questionId}
                  questionText={q.text}
                  series={longitudinal[q.questionId]}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
