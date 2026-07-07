import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function QrCodeAnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/qr-codes/${id}/analytics`)
}
