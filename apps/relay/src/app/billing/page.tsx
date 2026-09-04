import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { PaymentForm } from "./payment-form"

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { subscriptionStatus: true, trialEndsAt: true, name: true },
  })

  // Already active — send back to app
  if (org?.subscriptionStatus === "active") redirect("/dashboard")

  const trialEndsAt = org?.trialEndsAt?.toISOString() ?? null
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <PaymentForm
          orgName={org?.name ?? ""}
          trialEndsAt={trialEndsAt}
          publishableKey={publishableKey}
        />
      </div>
    </div>
  )
}
