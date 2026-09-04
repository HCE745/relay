"use client"

import { useEffect } from "react"

interface Props {
  darkMode: boolean
}

export function DarkModeProvider({ darkMode }: Props) {
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  return null
}
