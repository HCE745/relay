import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { FeedbackForm } from "../feedback-form"

export const dynamic = "force-dynamic"

export default async function LocationFeedbackPage({
  params,
}: {
  params: Promise<{ orgSlug: string; locationSlug: string }>
}) {
  const { orgSlug, locationSlug } = await params

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true, name: true, logo: true, customer_voice_enabled: true,
      locations: {
        where:  { slug: locationSlug },
        select: { id: true, name: true, slug: true },
        take:   1,
      },
    },
  })

  if (!org || !org.customer_voice_enabled) notFound()

  const location = org.locations[0]
  if (!location) notFound()

  return (
    <FeedbackForm
      orgSlug={orgSlug}
      orgName={org.name}
      orgLogo={org.logo}
      locationSlug={location.slug}
      locationName={location.name}
    />
  )
}
