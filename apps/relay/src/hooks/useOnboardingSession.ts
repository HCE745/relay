"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface OnboardingSessionData {
  id: string
  organizationId: string
  currentStage: number
  stageData: Record<string, unknown>
  skippedStages: number[]
  draftOps: unknown[]
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

interface UseOnboardingSessionReturn {
  session: OnboardingSessionData | null
  loading: boolean
  updateSession: (data: Partial<Pick<OnboardingSessionData, "currentStage" | "stageData" | "skippedStages" | "draftOps">>) => Promise<void>
  markStageSkipped: (stage: number) => Promise<void>
  markStageComplete: (stage: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useOnboardingSession(): UseOnboardingSessionReturn {
  const [session, setSession] = useState<OnboardingSessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/session")
      if (res.ok) {
        const data = await res.json() as OnboardingSessionData
        setSession(data)
      }
    } catch {
      // Non-fatal — fall back to localStorage-only mode
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const updateSession = useCallback(async (
    data: Partial<Pick<OnboardingSessionData, "currentStage" | "stageData" | "skippedStages" | "draftOps">>
  ) => {
    // Optimistic update
    setSession(prev => prev ? { ...prev, ...data } : null)

    // Debounced server write
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/onboarding/session", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          const updated = await res.json() as OnboardingSessionData
          setSession(updated)
        }
      } catch {
        // Non-fatal
      }
    }, 500)
  }, [])

  const markStageSkipped = useCallback(async (stage: number) => {
    setSession(prev => {
      if (!prev) return prev
      const skippedStages = prev.skippedStages.includes(stage)
        ? prev.skippedStages
        : [...prev.skippedStages, stage]
      return { ...prev, skippedStages }
    })
    setSession(prev => {
      if (!prev) return prev
      const skippedStages = prev.skippedStages.includes(stage)
        ? prev.skippedStages
        : [...prev.skippedStages, stage]
      updateSession({ skippedStages })
      return prev
    })
  }, [updateSession])

  const markStageComplete = useCallback(async (stage: number) => {
    setSession(prev => {
      if (!prev) return prev
      const skippedStages = prev.skippedStages.filter(s => s !== stage)
      updateSession({ currentStage: stage + 1, skippedStages })
      return { ...prev, currentStage: stage + 1, skippedStages }
    })
  }, [updateSession])

  return {
    session,
    loading,
    updateSession,
    markStageSkipped,
    markStageComplete,
    refresh: fetchSession,
  }
}
