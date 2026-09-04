"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { USER_ROLE } from "@/lib/constants"

interface OrgUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  managerId: string | null
  department: { name: string } | null
}

interface NodeProps {
  user: OrgUser
  allUsers: OrgUser[]
  depth: number
  sessionUserId: string
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  MANAGER: "bg-blue-100 text-blue-800",
  SUPERVISOR: "bg-indigo-100 text-indigo-800",
  EMPLOYEE: "bg-gray-100 text-gray-600",
  VENDOR: "bg-orange-100 text-orange-800",
  HR: "bg-pink-100 text-pink-800",
}

const AVATAR_COLOR: Record<string, string> = {
  ADMIN: "bg-purple-500",
  MANAGER: "bg-blue-500",
  SUPERVISOR: "bg-indigo-500",
  EMPLOYEE: "bg-gray-500",
  VENDOR: "bg-orange-500",
  HR: "bg-pink-500",
}

function OrgNode({ user, allUsers, depth, sessionUserId }: NodeProps) {
  const children = allUsers.filter(u => u.managerId === user.id)
  const [expanded, setExpanded] = useState(depth < 2)
  const isMe = user.id === sessionUserId

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 24 }} className="relative">
      {depth > 0 && (
        <div className="absolute left-[-16px] top-[20px] w-4 h-px bg-gray-200" />
      )}
      {depth > 0 && (
        <div className="absolute left-[-16px] top-0 w-px h-[20px] bg-gray-200" />
      )}

      <div className={`flex items-start gap-2.5 py-2 group`}>
        {children.length > 0 ? (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-1 shrink-0 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
          isMe ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
        } ${!user.isActive ? "opacity-50" : ""}`}>
          <div className={`w-8 h-8 rounded-full ${AVATAR_COLOR[user.role] ?? "bg-gray-400"} flex items-center justify-center shrink-0`}>
            <span className="text-white text-sm font-medium">{user.name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 truncate">{user.name}</span>
              {isMe && <span className="text-xs text-blue-600 font-medium">(you)</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLOR[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                {USER_ROLE[user.role as keyof typeof USER_ROLE] ?? user.role}
              </span>
              {user.department && (
                <span className="text-xs text-gray-400 truncate">{user.department.name}</span>
              )}
            </div>
          </div>
        </div>

        {children.length > 0 && (
          <span className="mt-3 text-xs text-gray-400 shrink-0">
            {children.length} direct {children.length === 1 ? "report" : "reports"}
          </span>
        )}
      </div>

      {expanded && children.length > 0 && (
        <div className="relative ml-6 border-l border-gray-200">
          {children.map(child => (
            <OrgNode
              key={child.id}
              user={child}
              allUsers={allUsers}
              depth={depth + 1}
              sessionUserId={sessionUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OrgChart({ users, sessionUserId }: { users: OrgUser[]; sessionUserId: string }) {
  const activeUsers = users.filter(u => u.isActive)
  // Root nodes: no manager or manager outside this org
  const orgIds = new Set(users.map(u => u.id))
  const roots = activeUsers.filter(u => !u.managerId || !orgIds.has(u.managerId))

  if (roots.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No hierarchy set up yet. Use &ldquo;Manage → Set Manager&rdquo; to assign reporting relationships.
      </div>
    )
  }

  return (
    <div className="space-y-1 p-4">
      {roots.map(root => (
        <OrgNode
          key={root.id}
          user={root}
          allUsers={activeUsers}
          depth={0}
          sessionUserId={sessionUserId}
        />
      ))}
    </div>
  )
}
