"use client"
import { createContext, useContext, useCallback, useEffect, useState } from "react"
import { Joyride, EVENTS, ACTIONS, STATUS } from "react-joyride"
import type { EventData } from "react-joyride"
import { usePathname, useRouter } from "next/navigation"
import { TOUR_STEPS } from "@/components/tour/tour-steps"

const SEEN_KEY = "hce-tour-seen"

type TourCtx = { startTour: () => void }
const TourContext = createContext<TourCtx>({ startTour: () => {} })
export const useTour = () => useContext(TourContext)

function waitForElement(selector: string, timeout = 8000): Promise<boolean> {
  if (selector === "body") return Promise.resolve(true)
  return new Promise((resolve) => {
    if (document.querySelector(selector)) { resolve(true); return }
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect()
        resolve(true)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(false) }, timeout)
  })
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(SEEN_KEY)) {
      const t = setTimeout(() => setRun(true), 900)
      return () => clearTimeout(t)
    }
  }, [])

  const startTour = useCallback(() => {
    localStorage.removeItem(SEEN_KEY)
    setStepIndex(0)
    setTimeout(() => setRun(true), 100)
  }, [])

  const navigateAndResume = useCallback(
    async (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= TOUR_STEPS.length) return

      const step = TOUR_STEPS[targetIdx]
      const nav = step.data?.navigate
      const target = step.target as string

      const needsNav = !!nav && nav !== pathname
      const elementMissing = target !== "body" && !document.querySelector(target)

      if (needsNav || elementMissing) {
        setRun(false)
        if (needsNav) router.push(nav!)
        const found = await waitForElement(target)
        if (found) {
          setStepIndex(targetIdx)
          setRun(true)
        }
      } else {
        setStepIndex(targetIdx)
      }
    },
    [pathname, router]
  )

  const handleEvent = useCallback(
    (data: EventData) => {
      const { action, index, status, type } = data

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(SEEN_KEY, "1")
        setRun(false)
        setStepIndex(0)
        return
      }

      if (action === ACTIONS.CLOSE) {
        localStorage.setItem(SEEN_KEY, "1")
        setRun(false)
        setStepIndex(0)
        return
      }

      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.NEXT) navigateAndResume(index + 1)
        else if (action === ACTIONS.PREV) navigateAndResume(index - 1)
      }
    },
    [navigateAndResume]
  )

  return (
    <TourContext.Provider value={{ startTour }}>
      <Joyride
        steps={TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        onEvent={handleEvent}
        options={{
          buttons: ["back", "skip", "primary"],
          showProgress: true,
          skipBeacon: true,
          overlayClickAction: false,
          primaryColor: "#2563eb",
          zIndex: 10000,
          targetWaitTimeout: 5000,
        }}
        locale={{
          back: "Back",
          close: "Close",
          last: "Finish",
          next: "Next →",
          skip: "Skip tour",
        }}
        styles={{
          tooltip: {
            borderRadius: "0.75rem",
            padding: "1.25rem",
            maxWidth: "420px",
          },
          tooltipTitle: {
            fontSize: "0.9375rem",
            fontWeight: "600",
            marginBottom: "0.5rem",
          },
          tooltipContent: {
            fontSize: "0.875rem",
            lineHeight: "1.5",
            padding: "0",
            whiteSpace: "pre-line" as const,
          },
          buttonPrimary: {
            backgroundColor: "#2563eb",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            padding: "0.375rem 0.875rem",
          },
          buttonBack: {
            color: "#6b7280",
            fontSize: "0.8125rem",
          },
          buttonSkip: {
            color: "#9ca3af",
            fontSize: "0.75rem",
          },
        }}
      />
      {children}
    </TourContext.Provider>
  )
}
