import "server-only"

export type HierarchyUser = { id: string; managerId: string | null }

// Returns all user IDs that are subordinate to userId (direct + indirect reports).
export function getSubordinateIds(userId: string, users: HierarchyUser[]): string[] {
  const result: string[] = []
  const queue = [userId]
  const visited = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const reports = users.filter(u => u.managerId === current).map(u => u.id)
    result.push(...reports)
    queue.push(...reports)
  }
  return result
}

// Returns true if targetUserId is anywhere below superiorId in the hierarchy.
export function isSubordinate(
  targetUserId: string,
  superiorId: string,
  users: HierarchyUser[]
): boolean {
  return getSubordinateIds(superiorId, users).includes(targetUserId)
}
