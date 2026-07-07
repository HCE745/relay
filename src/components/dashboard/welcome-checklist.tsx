import Link from "next/link"
import { CheckCircle2, Circle, PartyPopper } from "lucide-react"

interface ChecklistItem {
  label: string
  description: string
  done: boolean
  href: string
}

interface Props {
  items: ChecklistItem[]
  orgName: string
}

export function WelcomeChecklist({ items, orgName }: Props) {
  const doneCount = items.filter(i => i.done).length

  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Welcome to Relay!</p>
            <p className="text-blue-200 text-xs mt-0.5">
              Complete your setup — {doneCount} of {items.length} done
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{Math.round((doneCount / items.length) * 100)}%</div>
            <div className="text-blue-200 text-xs">complete</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 bg-blue-800/40 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-white h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {doneCount === items.length ? (
        <div className="px-6 py-8 text-center">
          <PartyPopper className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">You&apos;re all set, {orgName}!</p>
          <p className="text-sm text-gray-500 mt-1">
            Your workspace is ready. Explore the full platform.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(item => (
            <Link
              key={item.label}
              href={item.done ? "#" : item.href}
              className={`flex items-start gap-3 px-6 py-3.5 transition-colors ${item.done ? "cursor-default" : "hover:bg-gray-50"}`}
            >
              {item.done ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-medium ${item.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  {item.label}
                </p>
                {!item.done && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
