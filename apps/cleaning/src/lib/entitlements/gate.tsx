"use client"

// <Gate cap="..."> — declarative capability gating for client UI. Renders its
// children only when the current org has the capability; otherwise renders the
// optional fallback (e.g. an upgrade prompt).

import { useCanUse } from "./context"

export function Gate({
  cap,
  children,
  fallback = null,
}: {
  cap: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const canUse = useCanUse()
  return <>{canUse(cap) ? children : fallback}</>
}
