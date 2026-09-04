interface CrmActivity {
  id:              string
  eventType:       string
  description:     string
  createdBySAName: string
  createdAt:       string
}

interface Props {
  activities: CrmActivity[]
}

const EVENT_ICONS: Record<string, string> = {
  lifecycle_change:       "🔄",
  demo_scheduled:         "📅",
  demo_completed:         "✅",
  demo_cancelled:         "❌",
  trial_started:          "🚀",
  trial_activated_auto:   "⚡",
  trial_expired_auto:     "⏱️",
  non_conversion_logged:  "📋",
  crm_note_added:         "📝",
  subscription_converted: "💳",
  subscription_cancelled: "🚫",
}

export function CrmActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400">No activity yet.</p>
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-4">
      {activities.map(a => (
        <li key={a.id} className="ml-4">
          <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white border border-gray-200 rounded-full text-xs">
            {EVENT_ICONS[a.eventType] ?? "•"}
          </span>
          <p className="text-sm text-gray-800">{a.description}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {a.createdBySAName} · {new Date(a.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  )
}
