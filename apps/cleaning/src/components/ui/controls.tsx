import Link from "next/link"
import { cn } from "@hce/ui/utils"

// Presentational, server-safe controls (no "use client"). Client forms compose
// these. Purpose-built, minimal — promoted to @hce/ui only on a second consumer.

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

// One button hierarchy, shared by <Button> and <LinkButton>. Primary is a solid
// brand fill with a soft shadow so the main action on a screen is unmistakable;
// secondary is a quiet outline; danger is a clear destructive outline; ghost is
// chrome-free for toolbars.
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:ring-brand/40",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50 focus-visible:ring-slate-300",
  danger: "border border-red-300 bg-white text-red-700 shadow-xs hover:bg-red-50 focus-visible:ring-red-300",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
}
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-xs",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-5 py-2.5 text-sm",
}

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition outline-none focus-visible:ring-2 disabled:opacity-60 disabled:pointer-events-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
}

export function Button({ variant = "primary", size = "md", icon, className, children, ...props }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} {...props}>
      {icon ? <span className="-ml-0.5 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {children}
    </button>
  )
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
}

// A link styled as a button — replaces ad-hoc `<Link className="bg-brand…">`.
export function LinkButton({ variant = "primary", size = "md", icon, className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon ? <span className="-ml-0.5 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {children}
    </Link>
  )
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm", className)} {...props} />
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

const controlClasses =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:bg-slate-50"

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, "min-h-20", className)} {...props} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, className)} {...props} />
}

// Shared status badge — one component, semantic tones, used across Jobs, Time,
// Inspections, Issues and Invoices so a given state always looks the same.
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "purple"

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
  brand: "bg-teal-50 text-teal-700",
  purple: "bg-indigo-50 text-indigo-700",
}

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusPill({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Archived"}</StatusBadge>
}

// First-run / list empty state: icon, one-line explanation, and a working
// primary action. Provide either `action` (an on-screen control such as a
// dialog trigger) or `actionLabel`+`actionHref` (navigates to where the real
// action lives). `secondary` renders a muted link beneath the primary action.
export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
  children,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  actionLabel?: string
  actionHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {children ? <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div> : null}
      {action || (actionLabel && actionHref) || (secondaryLabel && secondaryHref) ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          {action ?? null}
          {actionLabel && actionHref ? (
            <Link href={actionHref} className={buttonClasses("primary", "md")}>
              {actionLabel}
            </Link>
          ) : null}
          {secondaryLabel && secondaryHref ? (
            <Link href={secondaryHref} className="text-xs font-medium text-slate-500 hover:text-brand">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
