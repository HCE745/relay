import { StatusBadge, type BadgeTone } from "@/components/ui/controls"

const TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  VOID: "neutral",
}
const LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", PAID: "Paid", VOID: "Void" }

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={TONE[status] ?? "neutral"} className={status === "VOID" ? "line-through text-slate-400" : undefined}>
      {LABEL[status] ?? status}
    </StatusBadge>
  )
}
