"use client"

import { TourProvider } from "./tour-context"
import { TourWelcomeModal } from "./tour-welcome-modal"
import { TourOverlay } from "./tour-overlay"
import { DemoPanel } from "./demo-panel"

interface Props {
  currentRole: string
  plan: string
  intelligenceModules: string[]
  initialIndustry: string
}

export function DemoTourHost({ currentRole, plan, intelligenceModules, initialIndustry }: Props) {
  return (
    <TourProvider initialIndustry={initialIndustry}>
      <DemoPanel
        currentRole={currentRole}
        plan={plan}
        intelligenceModules={intelligenceModules}
        currentIndustry={initialIndustry}
      />
      <TourWelcomeModal />
      <TourOverlay />
    </TourProvider>
  )
}
