import { redirect } from "next/navigation"
import type { SearchParams } from "next/dist/server/request/search-params"

export const dynamic = "force-dynamic"

// Legacy redirect — /sales/companies is now /sales/prospects
export default async function CompaniesRedirect({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const params = new URLSearchParams()
  if (typeof sp.q      === "string") params.set("q",      sp.q)
  if (typeof sp.status === "string") params.set("status", sp.status)
  if (typeof sp.sort   === "string") params.set("sort",   sp.sort)
  if (typeof sp.page   === "string") params.set("page",   sp.page)
  const qs = params.toString()
  redirect(`/sales/prospects${qs ? `?${qs}` : ""}`)
}
