"use client"

// Client-side capability access. A server component resolves the effective
// capability list once (via resolveCapabilities) and passes it down; client
// components then gate UI with useCanUse() / <Gate> without re-deriving.

import { createContext, useContext, useMemo } from "react"

const CapabilityContext = createContext<ReadonlySet<string> | null>(null)

export function CapabilityProvider({
  capabilities,
  children,
}: {
  capabilities: string[]
  children: React.ReactNode
}) {
  const set = useMemo(() => new Set(capabilities), [capabilities])
  return <CapabilityContext.Provider value={set}>{children}</CapabilityContext.Provider>
}

/** Returns a `canUse(cap)` predicate scoped to the current org's capabilities. */
export function useCanUse(): (capability: string) => boolean {
  const set = useContext(CapabilityContext)
  if (!set) {
    throw new Error("useCanUse must be used within a <CapabilityProvider>")
  }
  return (capability: string) => set.has(capability)
}
