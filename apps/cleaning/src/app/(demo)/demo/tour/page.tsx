import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { TourCheck } from "@/components/demo/tour/tour-check"
import { TourLanding } from "@/components/demo/tour/tour-landing"

export const dynamic = "force-dynamic"

// Demo-only. `?check=1` runs the developer breakage walk; otherwise it's the
// tour start/restart landing. Both require a demo session.
export default async function TourPage({ searchParams }: { searchParams: Promise<{ check?: string }> }) {
  const session = await getSession()
  if (!session?.isDemo) redirect("/demo")
  const { check } = await searchParams
  return check === "1" ? <TourCheck /> : <TourLanding />
}
