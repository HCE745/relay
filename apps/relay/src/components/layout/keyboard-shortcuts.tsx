"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

const GO_MAP: Record<string, string> = {
  d: "/dashboard",
  i: "/issues",
  a: "/assets",
  t: "/team",
  s: "/settings",
  n: "/notifications",
}

interface ShortcutGroup {
  title: string
  items: { keys: string[][]; description: string }[]
}

function getGroups(isDemoMode: boolean): ShortcutGroup[] {
  return [
    {
      title: "Navigation",
      items: [
        { keys: [["g"], ["d"]], description: "Go to Dashboard" },
        { keys: [["g"], ["i"]], description: "Go to Issues" },
        { keys: [["g"], ["a"]], description: "Go to Assets" },
        { keys: [["g"], ["t"]], description: "Go to Team" },
        { keys: [["g"], ["s"]], description: "Go to Settings" },
      ],
    },
    {
      title: "Issues",
      items: [
        { keys: [["n"]], description: "New issue" },
        { keys: [["/"], ["⌘", "K"]], description: "Search" },
      ],
    },
    ...(isDemoMode
      ? [
          {
            title: "Demo",
            items: [
              { keys: [["Ctrl", "Shift", "T"]], description: "Toggle guided tour" },
              { keys: [["Ctrl", "Shift", "D"]], description: "Show / hide demo panel" },
            ],
          },
        ]
      : []),
    {
      title: "General",
      items: [
        { keys: [["?"]], description: "Show keyboard shortcuts" },
        { keys: [["Esc"]], description: "Close modal / cancel" },
      ],
    },
  ]
}

interface Props {
  isDemoMode?: boolean
}

export function KeyboardShortcuts({ isDemoMode = false }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const gMode = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const inInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
        (e.target as HTMLElement).isContentEditable

      if (e.key === "Escape") {
        setShowModal(false)
        gMode.current = false
        if (gTimer.current) clearTimeout(gTimer.current)
      }

      if (inInput) return

      // g-sequence handler
      if (gMode.current) {
        gMode.current = false
        if (gTimer.current) clearTimeout(gTimer.current)
        const target = GO_MAP[e.key]
        if (target) {
          e.preventDefault()
          router.push(target)
        }
        return
      }

      if (e.key === "?" ) {
        e.preventDefault()
        setShowModal(v => !v)
        return
      }

      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        router.push("/issues/new")
        return
      }

      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        gMode.current = true
        gTimer.current = setTimeout(() => { gMode.current = false }, 1000)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  const groups = getGroups(isDemoMode)

  if (!showModal) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
      onClick={() => setShowModal(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowModal(false)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 max-h-[70vh] overflow-y-auto">
          {groups.map(group => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                {group.title}
              </p>
              {group.items.map(({ keys, description }) => (
                <div
                  key={description}
                  className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-700">{description}</span>
                  <div className="flex items-center gap-1.5">
                    {keys.map((combo, ci) => (
                      <span key={ci} className="flex items-center gap-0.5">
                        {ci > 0 && (
                          <span className="text-gray-300 text-xs mx-0.5">or</span>
                        )}
                        {combo.map((k, ki) => (
                          <span key={ki} className="flex items-center">
                            {ki > 0 && <span className="text-gray-300 text-[10px] mx-0.5">+</span>}
                            <kbd className="text-xs bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-600">
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
          Press <kbd className="bg-gray-100 rounded px-1">?</kbd> to toggle
        </div>
      </div>
    </div>
  )
}
