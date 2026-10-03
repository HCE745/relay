"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export function SeedRatesButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function seed() {
    setBusy(true)
    await apiSend("/api/production-rates/seed", "POST")
    setBusy(false)
    router.refresh()
  }
  return <Button onClick={seed} disabled={busy}>{busy ? "Seeding…" : "Seed industry-standard rates"}</Button>
}
