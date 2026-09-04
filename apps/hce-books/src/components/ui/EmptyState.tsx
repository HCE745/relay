import type { LucideIcon } from "lucide-react"
import Link from "next/link"

type Action = {
  label: string
  href?: string
  onClick?: () => void
  secondary?: boolean
}

type Props = {
  icon: LucideIcon
  title: string
  description?: string
  actions?: Action[]
}

export function EmptyState({ icon: Icon, title, description, actions }: Props) {
  return (
    <tr>
      <td colSpan={99}>
        <div className="empty-state">
          <Icon className="empty-state-icon" />
          <p className="empty-state-title">{title}</p>
          {description && <p className="empty-state-desc">{description}</p>}
          {actions && actions.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {actions.map((action, i) =>
                action.href ? (
                  <Link
                    key={i}
                    href={action.href}
                    className={action.secondary ? "btn-secondary" : "btn-primary"}
                  >
                    {action.label}
                  </Link>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={action.onClick}
                    className={action.secondary ? "btn-secondary" : "btn-primary"}
                  >
                    {action.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// Non-table version for use in cards
export function EmptyCard({ icon: Icon, title, description, actions }: Props) {
  return (
    <div className="empty-state">
      <Icon className="empty-state-icon" />
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {actions.map((action, i) =>
            action.href ? (
              <Link
                key={i}
                href={action.href}
                className={action.secondary ? "btn-secondary" : "btn-primary"}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className={action.secondary ? "btn-secondary" : "btn-primary"}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
