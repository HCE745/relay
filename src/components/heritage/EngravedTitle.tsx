import React from "react"

interface Props {
  children: React.ReactNode
  as?: "h1" | "h2" | "h3" | "span" | "p"
  className?: string
  inverse?: boolean
}

// Applies a multi-layer text-shadow stack that reads as engraved lettering
// in Heritage. In Contemporary the CSS class has no effect.
export function EngravedTitle({ children, as: Tag = "span", className = "", inverse = false }: Props) {
  return (
    <Tag className={`${inverse ? "heritage-engraved-inverse" : "heritage-engraved"} ${className}`}>
      {children}
    </Tag>
  )
}
