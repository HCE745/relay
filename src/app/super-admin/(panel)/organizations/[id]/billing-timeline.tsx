import { format, formatDistanceToNow } from "date-fns"
import { Calendar, CreditCard, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import type { BillingCredit } from "@/generated/prisma/client"

interface Org {
  trialEndsAt?:            Date | null
  subscriptionStatus:      string
  plan:                    string
  monthlyTotalBeforeDiscount?: number | null
  monthlyTotalAfterDiscount?:  number | null
  discountPercent?:        number | null
  discountLabel?:          string | null
}

interface TimelineProps {
  org:     Org
  credits: BillingCredit[]
}

type CreditStatus = "pending" | "scheduled" | "active" | "completed" | "cancelled" | "expired"

const STATUS_DOT: Record<CreditStatus, string> = {
  active:    "bg-green-400",
  scheduled: "bg-blue-400",
  pending:   "bg-yellow-400",
  completed: "bg-gray-500",
  cancelled: "bg-gray-600",
  expired:   "bg-red-400",
}

const STATUS_LABEL_COLOR: Record<CreditStatus, string> = {
  active:    "text-green-300",
  scheduled: "text-blue-300",
  pending:   "text-yellow-300",
  completed: "text-gray-400",
  cancelled: "text-gray-500",
  expired:   "text-red-400",
}

function describeCredit(c: BillingCredit): string {
  switch (c.creditType) {
    case "percentage_off":  return `${c.discountValue}% off`
    case "fixed_amount":    return `$${c.discountValue}/mo off`
    case "free_billing_cycles": return `${c.durationCycles ?? c.discountValue} free cycle${(c.durationCycles ?? c.discountValue) !== 1 ? "s" : ""}`
    default:                return c.creditType.replace(/_/g, " ")
  }
}

function describeDurationEnd(c: BillingCredit): string {
  if (c.durationType === "one_invoice")     return "one invoice"
  if (c.durationType === "until_cancelled") return "ongoing"
  if (c.durationType === "until_date" && c.durationUntilDate) {
    return `until ${format(c.durationUntilDate, "MMM d, yyyy")}`
  }
  if (c.durationType === "x_billing_cycles" && c.durationCycles) {
    if (c.effectiveDate) {
      const ends = new Date(c.effectiveDate.getTime() + c.durationCycles * 30.44 * 24 * 60 * 60 * 1000)
      return `until ${format(ends, "MMM d, yyyy")}`
    }
    return `${c.durationCycles} cycles`
  }
  return "—"
}

export function BillingTimeline({ org, credits }: TimelineProps) {
  const now = new Date()

  // Build timeline events
  type Event = {
    date: Date
    label: string
    sublabel?: string
    color: string
    icon: typeof Calendar
    dotColor: string
    dim?: boolean
  }

  const events: Event[] = []

  // Trial end
  if (org.trialEndsAt) {
    const past = org.trialEndsAt < now
    events.push({
      date:     org.trialEndsAt,
      label:    past ? "Trial ended" : "Trial ends",
      sublabel: format(org.trialEndsAt, "MMM d, yyyy"),
      color:    past ? "text-gray-400" : "text-amber-300",
      icon:     Calendar,
      dotColor: past ? "bg-gray-500" : "bg-amber-400",
      dim:      past,
    })
  }

  // Active credits
  for (const c of credits) {
    const status = c.status as CreditStatus

    if (status === "completed" || status === "cancelled" || status === "expired") {
      // History events
      if (c.effectiveDate) {
        events.push({
          date:     c.effectiveDate,
          label:    `Credit started: ${c.description}`,
          sublabel: describeCredit(c),
          color:    STATUS_LABEL_COLOR[status],
          icon:     CreditCard,
          dotColor: STATUS_DOT[status],
          dim:      true,
        })
      }
      if (c.completionDate) {
        const icon = status === "cancelled" ? XCircle : status === "expired" ? AlertCircle : CheckCircle
        events.push({
          date:     c.completionDate,
          label:    `Credit ${status}: ${c.description}`,
          sublabel: "",
          color:    STATUS_LABEL_COLOR[status],
          icon,
          dotColor: STATUS_DOT[status],
          dim:      true,
        })
      }
    } else if (status === "active") {
      if (c.effectiveDate) {
        events.push({
          date:     c.effectiveDate,
          label:    `Active: ${c.description}`,
          sublabel: `${describeCredit(c)} · ${describeDurationEnd(c)}`,
          color:    "text-green-300",
          icon:     CreditCard,
          dotColor: "bg-green-400",
        })
      }
      // End event if has fixed duration
      if (c.durationType === "until_date" && c.durationUntilDate) {
        events.push({
          date:     c.durationUntilDate,
          label:    `Credit expires: ${c.description}`,
          sublabel: "",
          color:    "text-red-300",
          icon:     AlertCircle,
          dotColor: "bg-red-400",
        })
      } else if (c.durationType === "x_billing_cycles" && c.durationCycles && c.effectiveDate) {
        const ends = new Date(c.effectiveDate.getTime() + c.durationCycles * 30.44 * 24 * 60 * 60 * 1000)
        events.push({
          date:     ends,
          label:    `Credit completes: ${c.description}`,
          sublabel: `After ${c.durationCycles} cycles`,
          color:    "text-blue-300",
          icon:     CheckCircle,
          dotColor: "bg-blue-400",
        })
      }
    } else if (status === "scheduled" || status === "pending") {
      const startDate = c.scheduledStartDate ?? undefined
      if (startDate) {
        events.push({
          date:     startDate,
          label:    `Scheduled: ${c.description}`,
          sublabel: `${describeCredit(c)} starts ${format(startDate, "MMM d, yyyy")}`,
          color:    "text-blue-300",
          icon:     Clock,
          dotColor: "bg-blue-400",
        })
      } else {
        // Pending — no known date
        events.push({
          date:     now,
          label:    `Pending: ${c.description}`,
          sublabel: `Waiting for trigger: ${c.schedulingType.replace(/_/g, " ")}`,
          color:    "text-yellow-300",
          icon:     Clock,
          dotColor: "bg-yellow-400",
        })
      }
    }
  }

  // Sort: past events desc, future events asc relative to now
  events.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Current plan marker (insert at now)
  const planMarker: Event = {
    date:     now,
    label:    `Current plan: ${org.plan}`,
    sublabel: org.monthlyTotalAfterDiscount != null
      ? `$${org.monthlyTotalAfterDiscount.toFixed(2)}/mo${org.monthlyTotalBeforeDiscount != null && org.monthlyTotalAfterDiscount < org.monthlyTotalBeforeDiscount ? ` (was $${org.monthlyTotalBeforeDiscount.toFixed(2)})` : ""}`
      : org.subscriptionStatus,
    color:    "text-white",
    icon:     Calendar,
    dotColor: "bg-indigo-400",
  }

  // Insert now marker
  const pastEvents   = events.filter(e => e.date < now && !e.dim || (e.dim && e.date < now))
  const futureEvents = events.filter(e => e.date > now)

  const allEvents = [...events.filter(e => e.date < now), planMarker, ...futureEvents]

  if (allEvents.length <= 1) return null

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Billing Timeline</h2>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-700" />

        <div className="space-y-4 pl-8">
          {allEvents.map((ev, i) => {
            const Icon = ev.icon
            const isPast = ev.date < now && ev !== planMarker
            return (
              <div key={i} className={`relative ${isPast ? "opacity-50" : ""}`}>
                {/* Dot */}
                <div className={`absolute -left-[26px] top-1 w-2.5 h-2.5 rounded-full ${ev.dotColor} border-2 border-gray-900`} />

                <div>
                  <p className={`text-xs font-medium ${ev.color}`}>{ev.label}</p>
                  {ev.sublabel && <p className="text-xs text-gray-500 mt-0.5">{ev.sublabel}</p>}
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {ev === planMarker ? "Now" : isPast
                      ? formatDistanceToNow(ev.date, { addSuffix: true })
                      : format(ev.date, "MMM d, yyyy") + " · " + formatDistanceToNow(ev.date, { addSuffix: true })
                    }
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
