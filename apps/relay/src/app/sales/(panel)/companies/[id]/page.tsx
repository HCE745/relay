import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// Legacy redirect — /sales/companies/[id] is now /sales/prospects/[id]
export default async function CompanyDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/sales/prospects/${id}`)
}
