"use client"

import { useState, useRef, useEffect, useCallback, useId } from "react"
import { X, ChevronDown, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Person {
  id: string
  name: string
  role?: string
  email?: string
  department?: string
  location?: string
}

interface PeoplePickerProps {
  people: Person[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  emptyLabel?: string
  className?: string
  disabled?: boolean
  /** Extra classes applied to the dropdown list */
  dropdownClassName?: string
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN:      "bg-purple-100 text-purple-700",
  MANAGER:    "bg-blue-100 text-blue-700",
  SUPERVISOR: "bg-indigo-100 text-indigo-700",
  EMPLOYEE:   "bg-gray-100 text-gray-600",
}

function roleBadge(role: string) {
  const label = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
  const color = ROLE_COLORS[role.toUpperCase()] ?? "bg-gray-100 text-gray-600"
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none", color)}>
      {label}
    </span>
  )
}

function scoreMatch(person: Person, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    person.name.toLowerCase().includes(q) ||
    (person.role?.toLowerCase().includes(q) ?? false) ||
    (person.email?.toLowerCase().includes(q) ?? false) ||
    (person.department?.toLowerCase().includes(q) ?? false) ||
    (person.location?.toLowerCase().includes(q) ?? false)
  )
}

export function PeoplePicker({
  people,
  value,
  onChange,
  placeholder = "Search people…",
  emptyLabel = "Unassigned",
  className,
  disabled = false,
  dropdownClassName,
}: PeoplePickerProps) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = people.find(p => p.id === value) ?? null
  const filtered = people.filter(p => scoreMatch(p, query))

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
        setHighlighted(-1)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  // Reset highlighted when filtered list changes
  useEffect(() => { setHighlighted(-1) }, [query])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return
    const item = listRef.current.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [highlighted])

  function openPicker() {
    if (disabled) return
    setOpen(true)
    setQuery("")
    setHighlighted(-1)
    // Focus input on next tick so dropdown is mounted
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function closePicker() {
    setOpen(false)
    setQuery("")
    setHighlighted(-1)
  }

  function selectPerson(id: string) {
    onChange(id)
    closePicker()
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange("")
    closePicker()
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Include -1 offset for the "emptyLabel" option at the top
    const total = filtered.length + 1  // +1 for empty slot
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlighted(h => Math.min(h + 1, total - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlighted(h => Math.max(h - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (highlighted === 0) { selectPerson(""); break }
        if (highlighted > 0 && filtered[highlighted - 1]) {
          selectPerson(filtered[highlighted - 1].id)
        } else if (filtered.length === 1) {
          selectPerson(filtered[0].id)
        }
        break
      case "Escape":
        e.preventDefault()
        closePicker()
        break
    }
  }, [filtered, highlighted]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${inputId}-listbox`}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white text-left transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400"
            : "border-gray-300 hover:border-gray-400 cursor-pointer",
          open && "ring-2 ring-blue-500 border-blue-300"
        )}
      >
        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />

        {selected ? (
          <span className="flex-1 flex items-center gap-2 min-w-0">
            <span className="truncate font-medium text-gray-900">{selected.name}</span>
            {selected.role && roleBadge(selected.role)}
          </span>
        ) : (
          <span className="flex-1 text-gray-400">{emptyLabel}</span>
        )}

        <span className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={clear}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") clear(e as unknown as React.MouseEvent) }}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg",
            dropdownClassName
          )}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 min-w-0"
                aria-autocomplete="list"
                aria-controls={`${inputId}-listbox`}
                aria-activedescendant={highlighted >= 0 ? `${inputId}-opt-${highlighted}` : undefined}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Options */}
          <ul
            ref={listRef}
            id={`${inputId}-listbox`}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {/* Empty / unassigned slot */}
            <li
              id={`${inputId}-opt-0`}
              role="option"
              aria-selected={value === ""}
              onClick={() => selectPerson("")}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm text-gray-500 italic",
                "min-h-[44px]",  // touch target
                highlighted === 0 ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
              )}
            >
              <User className="w-3.5 h-3.5 opacity-40" />
              {emptyLabel}
            </li>

            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-400 text-center">No results found</li>
            )}

            {filtered.map((person, idx) => {
              const optIdx = idx + 1  // offset by the empty slot
              const isSelected = person.id === value
              const isHighlighted = highlighted === optIdx
              return (
                <li
                  key={person.id}
                  id={`${inputId}-opt-${optIdx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectPerson(person.id)}
                  className={cn(
                    "flex items-start gap-2.5 px-3 py-2 cursor-pointer min-h-[44px]",
                    isHighlighted ? "bg-blue-50" : isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-gray-600">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-sm font-medium truncate", isSelected ? "text-blue-700" : "text-gray-900")}>
                        {person.name}
                      </span>
                      {person.role && roleBadge(person.role)}
                    </div>
                    {(person.email || person.department || person.location) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {[person.email, person.department, person.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-blue-500 text-xs mt-1 flex-shrink-0">✓</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
