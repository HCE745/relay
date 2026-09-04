"use client"

import { createContext, useContext } from "react"

const ReadOnlyContext = createContext(false)

export function ReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean
  children: React.ReactNode
}) {
  return (
    <ReadOnlyContext.Provider value={readOnly}>
      {children}
    </ReadOnlyContext.Provider>
  )
}

export function useReadOnly() {
  return useContext(ReadOnlyContext)
}

// Wraps any interactive element so it's disabled and shows a tooltip in read-only mode.
// Usage: <ReadOnlyGuard><button>New Issue</button></ReadOnlyGuard>
export function ReadOnlyGuard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const readOnly = useReadOnly()
  if (!readOnly) return <>{children}</>

  return (
    <span
      className={`relative group inline-block ${className ?? ""}`}
      title="Subscription required — upgrade to restore full access"
    >
      <span className="pointer-events-none opacity-50 select-none">{children}</span>
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center whitespace-nowrap bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg z-50 pointer-events-none">
        Subscription required — upgrade to restore full access
      </span>
    </span>
  )
}
