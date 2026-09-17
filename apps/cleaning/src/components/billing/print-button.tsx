"use client"

import { Button } from "@/components/ui/controls"

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      Print
    </Button>
  )
}
