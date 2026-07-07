import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// CSV columns (case-insensitive):
// name, category, description, vendor_sku, manufacturer, model_number,
// estimated_cost, replacement_url, auto_approve_below, notes

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const text = await req.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 })
  }

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, "_"))
  const col = (name: string) => headers.indexOf(name)

  const rows = lines.slice(1)
  const imported: string[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const parts = parseCsvLine(rows[i])
    const name = parts[col("name")]?.trim()
    if (!name) { errors.push(`Row ${i + 2}: name is required`); continue }

    try {
      const item = await prisma.approvedCatalogItem.create({
        data: {
          organizationId: session.organizationId,
          name,
          category:        parts[col("category")]?.trim() || "GENERAL",
          description:     parts[col("description")]?.trim() || null,
          vendorSku:       parts[col("vendor_sku")]?.trim() || null,
          manufacturer:    parts[col("manufacturer")]?.trim() || null,
          modelNumber:     parts[col("model_number")]?.trim() || null,
          estimatedCost:   parseFloat(parts[col("estimated_cost")] ?? "") || null,
          replacementUrl:  parts[col("replacement_url")]?.trim() || null,
          autoApproveBelow: parseFloat(parts[col("auto_approve_below")] ?? "") || null,
          notes:           parts[col("notes")]?.trim() || null,
        },
      })
      imported.push(item.id)
    } catch {
      errors.push(`Row ${i + 2}: failed to import "${name}"`)
    }
  }

  return NextResponse.json({ imported: imported.length, errors })
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
