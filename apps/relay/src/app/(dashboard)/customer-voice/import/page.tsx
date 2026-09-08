import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { CsvImporter } from "./csv-importer"

export const dynamic = "force-dynamic"

export default async function CustomerVoiceImportPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "HR"].includes(session.role)) redirect("/customer-voice")

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Customer Feedback</h1>
      <p className="text-sm text-gray-500 mb-8">Upload a CSV file to bulk-import historical customer feedback.</p>
      <CsvImporter />
    </div>
  )
}
