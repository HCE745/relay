"use client"

import { useState, useEffect, useRef } from "react"
import { X, Download, Share } from "lucide-react"
import { RelayIconWhite } from "@/components/logo"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISSED_KEY = "relay-install-dismissed-v2"

// Module-level ref so the captured event survives React StrictMode double-mount
let capturedPrompt: BeforeInstallPromptEvent | null = null

export function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already running as installed PWA — never show
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    ) return

    // User previously dismissed permanently
    if (localStorage.getItem(DISMISSED_KEY)) return

    const ua = navigator.userAgent
    const ios =
      /ipad|iphone|ipod/i.test(ua) &&
      !("MSStream" in window) &&
      !(navigator as Navigator & { standalone?: boolean }).standalone

    setIsIOS(ios)

    if (ios) {
      // iOS: show manual instructions after 15 s of usage
      const t = setTimeout(() => setShow(true), 15_000)
      return () => clearTimeout(t)
    }

    // Chrome/Android/Edge: listen for beforeinstallprompt
    // If we already captured it before this mount, use it immediately
    if (capturedPrompt) {
      promptRef.current = capturedPrompt
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      capturedPrompt = e as BeforeInstallPromptEvent
      promptRef.current = capturedPrompt
      // Small delay so the prompt doesn't appear on the very first page load
      setTimeout(() => setShow(true), 3_000)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem(DISMISSED_KEY, "1")
  }

  async function install() {
    const p = promptRef.current ?? capturedPrompt
    if (!p) return
    try {
      await p.prompt()
      const { outcome } = await p.userChoice
      if (outcome === "accepted") {
        setShow(false)
        capturedPrompt = null
        promptRef.current = null
      }
    } catch {
      // prompt() can throw if called more than once
    }
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50"
      role="dialog"
      aria-label="Install Relay app"
    >
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
        <div className="flex items-start gap-3 p-4">
          {/* App icon */}
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <RelayIconWhite size={28} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">Install Relay</p>
            <p className="text-xs font-medium text-blue-400 mt-0.5">Operations Platform</p>

            {isIOS ? (
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Tap the{" "}
                <span className="inline-flex items-center gap-0.5 text-gray-200 font-semibold">
                  <Share className="w-3 h-3" />
                  &nbsp;Share
                </span>{" "}
                button, then choose{" "}
                <span className="font-semibold text-gray-200">Add to Home Screen</span>.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  Get instant access and offline support — works like a native app.
                </p>
                <button
                  onClick={install}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              </>
            )}
          </div>

          <button
            onClick={dismiss}
            className="p-1 text-gray-500 hover:text-gray-300 rounded-lg flex-shrink-0 -mt-0.5"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
