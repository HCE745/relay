"use client"

import { createContext, useContext, useState, useCallback } from "react"

export const TOTAL_TOUR_STEPS = 21

interface TourState {
  isActive: boolean
  currentStep: number
  hasSeenWelcome: boolean
  lastExitedStep: number | null
  submittedIssueId: string | null
  firstIssueId: string | null
  firstAssetId: string | null
}

interface TourContextValue extends TourState {
  industry: string
  startTour: (fromStep?: number) => void
  exitTour: () => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  markWelcomeSeen: () => void
  setSubmittedIssueId: (id: string) => void
  setFirstIssueId: (id: string) => void
  setFirstAssetId: (id: string) => void
  setIndustry: (industry: string) => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour must be used within TourProvider")
  return ctx
}

export function TourProvider({ children, initialIndustry = "Manufacturing" }: { children: React.ReactNode; initialIndustry?: string }) {
  const [state, setState] = useState<TourState>(() => {
    const base: TourState = {
      isActive: false,
      currentStep: 1,
      hasSeenWelcome: false,
      lastExitedStep: null,
      submittedIssueId: null,
      firstIssueId: null,
      firstAssetId: null,
    }
    if (typeof window === "undefined") return base
    const params = new URLSearchParams(window.location.search)
    if (params.get("autoStartTour") === "1") return { ...base, isActive: true, hasSeenWelcome: true }
    if (params.get("skipWelcome")   === "1") return { ...base, hasSeenWelcome: true }
    return base
  })
  const [industry, setIndustryState] = useState(initialIndustry)

  const startTour = useCallback((fromStep = 1) => {
    setState(prev => ({ ...prev, isActive: true, currentStep: fromStep, lastExitedStep: null }))
  }, [])

  const exitTour = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false, lastExitedStep: prev.currentStep }))
  }, [])

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep >= TOTAL_TOUR_STEPS) {
        return { ...prev, isActive: false, lastExitedStep: null }
      }
      return { ...prev, currentStep: prev.currentStep + 1 }
    })
  }, [])

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep <= 1) return prev
      return { ...prev, currentStep: prev.currentStep - 1 }
    })
  }, [])

  const skipTour = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false, lastExitedStep: null }))
  }, [])

  const markWelcomeSeen = useCallback(() => {
    setState(prev => ({ ...prev, hasSeenWelcome: true }))
  }, [])

  const setSubmittedIssueId = useCallback((id: string) => {
    setState(prev => ({ ...prev, submittedIssueId: id }))
  }, [])

  const setFirstIssueId = useCallback((id: string) => {
    setState(prev => ({ ...prev, firstIssueId: id }))
  }, [])

  const setFirstAssetId = useCallback((id: string) => {
    setState(prev => ({ ...prev, firstAssetId: id }))
  }, [])

  const setIndustry = useCallback((ind: string) => {
    setIndustryState(ind)
  }, [])

  return (
    <TourContext.Provider value={{
      ...state,
      industry,
      startTour,
      exitTour,
      nextStep,
      prevStep,
      skipTour,
      markWelcomeSeen,
      setSubmittedIssueId,
      setFirstIssueId,
      setFirstAssetId,
      setIndustry,
    }}>
      {children}
    </TourContext.Provider>
  )
}
