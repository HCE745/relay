"use client"

import { useRouter } from "next/navigation"
import { Select } from "@/components/ui/controls"

// Navigates to /billing/invoices with the chosen customerId, preserving the
// active status filter.
export function CustomerFilter({
  customers,
  customerId,
  status,
}: {
  customers: { id: string; name: string }[]
  customerId?: string
  status?: string
}) {
  const router = useRouter()
  return (
    <Select
      className="w-56"
      value={customerId ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams()
        if (status) params.set("status", status)
        if (e.target.value) params.set("customerId", e.target.value)
        const qs = params.toString()
        router.push(`/billing/invoices${qs ? `?${qs}` : ""}`)
      }}
    >
      <option value="">All customers</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  )
}
