import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { FeedbackForm } from "./feedback-form"

export const dynamic = "force-dynamic"

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, logo: true, customer_voice_enabled: true },
  })

  if (!org || !org.customer_voice_enabled) notFound()

  return (
    <FeedbackForm
      orgSlug={orgSlug}
      orgName={org.name}
      orgLogo={org.logo}
      locationSlug={null}
      locationName={null}
    />
  )
}
