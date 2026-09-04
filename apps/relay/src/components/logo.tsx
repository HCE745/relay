"use client"

interface WordmarkProps {
  height?: number
  className?: string
}

export function RelayWordmark({ height = 32, className }: WordmarkProps) {
  const width = (height / 56) * 140
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 3 140 56"
      fill="none"
      className={className}
      aria-label="Relay"
    >
      <g transform="translate(-7.824 0.672) scale(1.1520)">
        <path d="M16 9 V39" stroke="#0b1f3a" strokeWidth="8" strokeLinecap="round" />
        <path d="M16 9 H27 A8.5 8.5 0 0 1 27 26 H19.5 L32 39" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 33.5 L32 39 L26.5 39" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="40.08" y="45.6" style={{ fontFamily: "var(--font-manrope), sans-serif" }} fontWeight="700" fontSize="48" letterSpacing="-1.7" fill="#0b1f3a">elay</text>
    </svg>
  )
}

export function RelayWordmarkWhite({ height = 32, className }: WordmarkProps) {
  const width = (height / 56) * 140
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 3 140 56"
      fill="none"
      className={className}
      aria-label="Relay"
    >
      <g transform="translate(-7.824 0.672) scale(1.1520)">
        <path d="M16 9 V39" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
        <path d="M16 9 H27 A8.5 8.5 0 0 1 27 26 H19.5 L32 39" stroke="#5b9bff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 33.5 L32 39 L26.5 39" stroke="#5b9bff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="40.08" y="45.6" style={{ fontFamily: "var(--font-manrope), sans-serif" }} fontWeight="700" fontSize="48" letterSpacing="-1.7" fill="#ffffff">elay</text>
    </svg>
  )
}

interface IconProps {
  size?: number
  className?: string
}

export function RelayIcon({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="1.75 0 48 48"
      fill="none"
      className={className}
      aria-label="Relay"
    >
      <path d="M16 9 V39" stroke="#0b1f3a" strokeWidth="8" strokeLinecap="round" />
      <path d="M16 9 H27 A8.5 8.5 0 0 1 27 26 H19.5 L32 39" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 33.5 L32 39 L26.5 39" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function RelayIconWhite({ size = 32, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="1.75 0 48 48"
      fill="none"
      className={className}
      aria-label="Relay"
    >
      <path d="M16 9 V39" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
      <path d="M16 9 H27 A8.5 8.5 0 0 1 27 26 H19.5 L32 39" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 33.5 L32 39 L26.5 39" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
