"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play } from "lucide-react"

type Template = { id: string; name: string }

export function RecurringActions({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function generateAll() {
    if (templates.length === 0) {
      toast.info("No templates due today")
      return
    }
    setRunning(true)
    let generated = 0
    let errors = 0
    for (const t of templates) {
      try {
        const res = await fetch(`/api/recurring/${t.id}/generate`, { method: "POST" })
        const data = await res.json()
        if (!res.ok) {
          errors++
          toast.error(`${t.name}: ${data.error}`)
        } else {
          generated += data.generated?.length ?? 0
        }
      } catch {
        errors++
      }
    }
    setRunning(false)
    if (generated > 0) toast.success(`Generated ${generated} entries`)
    if (errors === 0 && generated === 0) toast.info("Nothing new to generate")
    router.refresh()
  }

  return (
    <button
      onClick={generateAll}
      disabled={running}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
    >
      <Play className="w-4 h-4" />
      {running ? "Generating…" : `Generate Due (${templates.length})`}
    </button>
  )
}
