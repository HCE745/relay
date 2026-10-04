import Link from "next/link"
import { exitDemo } from "@/lib/demo/actions"

// Persistent banner shown across the admin app while in a demo session.
export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-700 px-4 py-2 text-center text-xs font-medium text-white">
      <span>Demo workspace — a private sandbox seeded with sample data. Changes are yours only and auto-delete after 24 hours.</span>
      <Link href="/demo" className="rounded-md bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25">Change data mix / reseed</Link>
      <form action={exitDemo} className="inline"><button className="rounded-md bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25">Exit demo</button></form>
    </div>
  )
}
