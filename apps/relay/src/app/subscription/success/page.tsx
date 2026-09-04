import { SuccessPoller } from "./success-poller"

export const dynamic = "force-dynamic"

export default async function SubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  return <SuccessPoller sessionId={session_id ?? null} />
}
