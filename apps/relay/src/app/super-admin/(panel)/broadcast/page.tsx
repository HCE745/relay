import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { BroadcastClient } from "@/components/super-admin/broadcast-client"

export const dynamic = "force-dynamic"

export default async function BroadcastPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const [broadcasts, orgs] = await Promise.all([
    prisma.broadcast.findMany({
      where:   { sentBySAId: session.superAdminId! },
      orderBy: { sentAt: "desc" },
      take:    20,
    }),
    prisma.organization.findMany({
      select: { id: true, name: true, plan: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ])

  return <BroadcastClient broadcasts={broadcasts} orgs={orgs} />
}
