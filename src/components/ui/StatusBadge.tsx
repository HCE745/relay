// Centralized status badge — consistent visual treatment across all pages

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  // Bills
  ENTERED:  { label: "Entered",  cls: "badge-blue" },
  // Invoices
  DRAFT:    { label: "Draft",    cls: "badge-amber" },
  SENT:     { label: "Sent",     cls: "badge-blue" },
  // Shared
  PARTIAL:  { label: "Partial",  cls: "badge-indigo" },
  PAID:     { label: "Paid",     cls: "badge-green" },
  OVERDUE:  { label: "Overdue",  cls: "badge-red" },
  VOID:     { label: "Void",     cls: "badge-gray" },
  // Journal
  POSTED:   { label: "Posted",   cls: "badge-green" },
  // Amortization
  ACTIVE:   { label: "Active",   cls: "badge-blue" },
  COMPLETED:{ label: "Completed",cls: "badge-green" },
  VOIDED:   { label: "Voided",   cls: "badge-gray" },
  // PO
  OPEN:     { label: "Open",     cls: "badge-blue" },
  CLOSED:   { label: "Closed",   cls: "badge-gray" },
  CANCELLED:{ label: "Cancelled",cls: "badge-gray" },
  RECEIVED: { label: "Received", cls: "badge-green" },
  PARTIALLY_RECEIVED: { label: "Part. Received", cls: "badge-indigo" },
  // Periods
  LOCKED:   { label: "Locked",   cls: "badge-amber" },
  // Anomalies
  DISMISSED:{ label: "Dismissed",cls: "badge-gray" },
  // Generic
  ERROR:    { label: "Error",    cls: "badge-red" },
  // Amortization types
  PREPAID_EXPENSE:    { label: "Prepaid",      cls: "badge-orange" },
  DEFERRED_REVENUE:   { label: "Deferred Rev", cls: "badge-purple" },
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cfg = STATUS_CONFIG[status]
  const displayLabel = label ?? cfg?.label ?? status
  const cls = cfg?.cls ?? "badge-gray"
  return <span className={`badge ${cls}`}>{displayLabel}</span>
}
