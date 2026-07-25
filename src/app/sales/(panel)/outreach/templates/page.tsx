import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileText, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const templates = await prisma.crmEmailTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:        true,
      name:      true,
      subject:   true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="text-gray-400 text-sm mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/super-admin/crm/templates"
          className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Manage Templates
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No templates yet</p>
          <Link href="/super-admin/crm/templates" className="text-xs text-emerald-500 hover:text-emerald-400">
            Create your first template →
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800/60">
            {templates.map(t => (
              <Link
                key={t.id}
                href={`/super-admin/crm/templates/${t.id}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-800/40 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white group-hover:text-emerald-300 transition-colors">{t.name}</p>
                  <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {formatDistanceToNow(t.updatedAt, { addSuffix: true })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
