import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { GitBranch, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SequencesPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const sequences = await prisma.crmSequence.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      name:        true,
      isActive:    true,
      createdAt:   true,
      _count:      { select: { steps: true, enrollments: true } },
    },
  })

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
          {sequences.map(seq => (
            <Link
              key={seq.id}
              href={`/super-admin/crm/sequences/${seq.id}`}
              className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                    <GitBranch className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{seq.name}</p>
                    <p className="text-xs text-gray-500">
                      {seq._count.steps} step{seq._count.steps !== 1 ? "s" : ""} · {seq._count.enrollments} enrolled
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  seq.isActive
                    ? "bg-emerald-900/40 text-emerald-400"
                    : "bg-gray-800 text-gray-500"
                }`}>
                  {seq.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
