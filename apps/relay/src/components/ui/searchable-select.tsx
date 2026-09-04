"use client"

import { useState, useRef, useEffect, useId } from "react"
import { ChevronDown, Search, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  id: string
  name: string
  meta?: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  emptyLabel?: string
  className?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyLabel = "Select...",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.id === value) ?? null
  const filtered = options.filter(o =>
    !query ||
    o.name.toLowerCase().includes(query.toLowerCase()) ||
    (o.meta?.toLowerCase().includes(query.toLowerCase()) ?? false)
  )

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  function openPicker() {
    if (disabled) return
    setOpen(true)
    setQuery("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setQuery("")
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange("")
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-left transition-colors focus:outline-none",
          "bg-white dark:bg-gray-800",
          disabled
            ? "border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer",
          open && "ring-2 ring-blue-500 border-blue-300 dark:border-blue-600"
        )}
      >
        <span className={cn("flex-1 truncate", selected ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500")}>
          {selected ? selected.name : emptyLabel}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span
              role="button"
              onClick={clear}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div
          id={`${uid}-dropdown`}
          className="absolute z-50 mt-1 w-full min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg"
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-gray-900 dark:text-white min-w-0"
                autoComplete="off"
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-400 text-center">No results</li>
            ) : (
              filtered.map(o => (
                <li
                  key={o.id}
                  onClick={() => select(o.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm min-h-[40px]",
                    o.id === value
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                >
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.meta && (
                    <span className="text-xs text-gray-400 truncate max-w-[120px] flex-shrink-0">{o.meta}</span>
                  )}
                  {o.id === value && <Check className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
