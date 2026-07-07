"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

// Sets Sentry tags on the client-side scope so client errors are tagged with
// the org context, enabling filtering in the Super Admin Diagnostics tab.
export function SentryOrgContext({ orgId, orgName }: { orgId: string; orgName: string }) {
  useEffect(() => {
    Sentry.getCurrentScope().setTags({
      organization_id: orgId,
      organization_name: orgName,
    })
  }, [orgId, orgName])

  return null
}
