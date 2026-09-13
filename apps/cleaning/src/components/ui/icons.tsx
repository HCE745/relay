// Server-safe inline icon set (no "use client"). Single stroke style so empty
// states, the setup guide, and dashboard tiles read as one system. 24×24,
// currentColor, 1.5 stroke — size/color via className on the caller.

type IconProps = { className?: string }

function base(children: React.ReactNode, className?: string) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-6 w-6"}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function BuildingIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M3 21h18" />
      <path d="M6 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" />
      <path d="M14 9h3a1 1 0 0 1 1 1v11" />
      <path d="M9 8h.01M9 12h.01M9 16h.01" />
    </>,
    className,
  )
}

export function MapPinIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </>,
    className,
  )
}

export function ClipboardListIcon({ className }: IconProps) {
  return base(
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
      <path d="M9 12h6M9 16h6" />
    </>,
    className,
  )
}

export function ClipboardCheckIcon({ className }: IconProps) {
  return base(
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
      <path d="m9 14 2 2 4-4" />
    </>,
    className,
  )
}

export function UsersIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 6a3 3 0 0 1 0 6" />
      <path d="M18 14a6 6 0 0 1 3 6" />
    </>,
    className,
  )
}

export function CalendarIcon({ className }: IconProps) {
  return base(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>,
    className,
  )
}

export function BriefcaseIcon({ className }: IconProps) {
  return base(
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </>,
    className,
  )
}

export function ClockIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    className,
  )
}

export function AlertTriangleIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>,
    className,
  )
}

export function InboxIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M6 4h12l3 9v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />
    </>,
    className,
  )
}

export function CheckCircleIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>,
    className,
  )
}

export function CircleIcon({ className }: IconProps) {
  return base(<circle cx="12" cy="12" r="9" />, className)
}

export function SparklesIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M6.3 6.3 9 9M15 15l2.7 2.7M17.7 6.3 15 9M9 15l-2.7 2.7" />
    </>,
    className,
  )
}
