"use client"

import { useState } from "react"
import { SetupWizard } from "./setup-wizard"
import { ConversationalOnboarding } from "./conversational-onboarding"

interface SharedProps {
  orgName: string
  userId: string
  initialIndustry?: string
  initialPlan?: string
}

export function OnboardingRouter(props: SharedProps) {
  const [mode, setMode] = useState<"conversational" | "wizard">("conversational")

  if (mode === "wizard") {
    return (
      <SetupWizard
        {...props}
        onSwitchToConversational={() => setMode("conversational")}
      />
    )
  }

  return (
    <ConversationalOnboarding
      {...props}
      onSwitchToWizard={() => setMode("wizard")}
    />
  )
}
