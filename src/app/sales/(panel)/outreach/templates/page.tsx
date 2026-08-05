import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileText, ExternalLink, Info } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/sales/login")

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

      {/* Performance note */}
      <div className="flex items-start gap-2.5 bg-gray-900 border border-amber-900/30 rounded-xl px-4 py-3 mb-4 text-xs text-amber-400/80">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
        <p>
          Template performance metrics (reply rate, times used) require tracking which template was used when sending each email.
          This is not currently stored — add a <code className="text-amber-300 bg-amber-900/20 px-1 rounded">templateId</code> field
          to <code className="text-amber-300 bg-amber-900/20 px-1 rounded">CrmEmail</code> to enable per-template analytics.
        </p>
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
          <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-0 border-b border-gray-800 px-4 py-2.5">
            <span className="text-xs text-gray-500 font-medium">Template</span>
            <span className="text-xs text-gray-500 font-medium text-right">Times Used</span>
            <span className="text-xs text-gray-500 font-medium text-right">Reply Rate</span>
            <span className="text-xs text-gray-500 font-medium text-right">Positive Rate</span>
            <span className="text-xs text-gray-500 font-medium text-right">Last Updated</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {templates.map(t => (
              <div key={t.id} className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-0 px-4 py-3.5 hover:bg-gray-800/40 transition-colors group items-center">
                <Link href={`/super-admin/crm/templates/${t.id}`} className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white group-hover:text-emerald-300 transition-colors truncate">{t.name}</p>
                    <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                  </div>
                </Link>
                <span className="text-xs text-gray-600 text-right" title="Template usage tracking not enabled">—</span>
                <span className="text-xs text-gray-600 text-right" title="Template usage tracking not enabled">—</span>
                <span className="text-xs text-gray-600 text-right" title="Template usage tracking not enabled">—</span>
                <span className="text-xs text-gray-500 text-right">
                  {formatDistanceToNow(t.updatedAt, { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
