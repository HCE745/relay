import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { GitBranch, ExternalLink, Users, CheckCircle2, PlayCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SequencesPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/sales/login")

  const sequences = await prisma.crmSequence.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:        true,
      name:      true,
      isActive:  true,
      isDefault: true,
      createdAt: true,
      _count: { select: { steps: true, enrollments: true } },
    },
  })

  // Per-sequence enrollment status breakdown
  const enrollmentStats = await prisma.crmEmailSequenceEnrollment.groupBy({
    by:    ["sequenceId", "status"],
    _count: true,
  }).catch(() => [] as { sequenceId: string; status: string; _count: number }[])

  const statsMap = new Map<string, Record<string, number>>()
  for (const row of enrollmentStats) {
    if (!statsMap.has(row.sequenceId)) statsMap.set(row.sequenceId, {})
    statsMap.get(row.sequenceId)![row.status] = row._count
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sequences</h1>
          <p className="text-gray-400 text-sm mt-0.5">{sequences.length} sequence{sequences.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/super-admin/crm/sequences"
          className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Manage Sequences
        </Link>
      </div>

      {sequences.length === 0 ? (
        <div className="text-center py-20">
          <GitBranch className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No sequences yet</p>
          <Link href="/super-admin/crm/sequences" className="text-xs text-emerald-500 hover:text-emerald-400">
            Create your first sequence →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const stats   = statsMap.get(seq.id) ?? {}
            const active  = stats.active  ?? 0
            const done    = stats.completed ?? 0
            const paused  = stats.paused ?? 0
            const stopped = stats.stopped ?? 0
            return (
              <div key={seq.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                      <GitBranch className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{seq.name}</p>
                        {seq.isDefault && (
                          <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {seq._count.steps} step{seq._count.steps !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/super-admin/crm/sequences/${seq.id}`}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      seq.isActive
                        ? "bg-emerald-900/40 text-emerald-400"
                        : "bg-gray-800 text-gray-500"
                    }`}>
                      {seq.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Enrollment metrics */}
                <div className="flex items-center gap-4 text-xs pt-3 border-t border-gray-800/60">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span><span className="font-semibold">{active}</span> active</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span><span className="font-semibold">{done}</span> completed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    <span><span className="font-semibold">{seq._count.enrollments}</span> total enrolled</span>
                  </div>
                  {paused > 0 && (
                    <div className="text-amber-500">
                      <span className="font-semibold">{paused}</span> paused
                    </div>
                  )}
                  {stopped > 0 && (
                    <div className="text-gray-600">
                      <span className="font-semibold">{stopped}</span> stopped
                    </div>
                  )}
                  <div className="ml-auto text-gray-600 text-[11px] italic">
                    Reply rate: N/A (requires reply-to-enrollment linking)
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
