"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "pl", label: "Polski" },
  { code: "nl", label: "Nederlands" },
] as const

type LangCode = (typeof LANGUAGES)[number]["code"]

interface Props {
  initialLanguage: string
}

export function LanguagePicker({ initialLanguage }: Props) {
  const [selected, setSelected] = useState<LangCode>(
    LANGUAGES.some(l => l.code === initialLanguage) ? (initialLanguage as LangCode) : "en"
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  async function handleChange(code: LangCode) {
    setSelected(code)
    setSaving(true)
    setSaved(false)
    try {
      await fetch("/api/settings/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      })
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Language</p>
        <p className="text-xs text-gray-400 mt-0.5">Interface language for Relay</p>
      </div>
      <div className="flex items-center gap-2">
        {saved && !saving && (
          <span className="text-xs text-green-600">Saved</span>
        )}
        <select
          value={selected}
          onChange={e => handleChange(e.target.value as LangCode)}
          disabled={saving}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
