export function isExternalUser(userType: string | undefined): boolean {
  return userType === "EXTERNAL"
}

/**
 * Returns true if the user is allowed to access the given path.
 * @param userType - The user's userType field ("INTERNAL" | "EXTERNAL" | undefined)
 * @param allowedPaths - Paths that external users are permitted to access (prefix-matched)
 * @param currentPath - The path the user is attempting to access
 */
export function checkExternalAccess(
  userType: string | undefined,
  allowedPaths: string[],
  currentPath: string
): boolean {
  // Non-external users always have access
  if (!isExternalUser(userType)) return true

  // External users are only allowed on explicitly whitelisted paths
  return allowedPaths.some((allowed) => {
    // Support prefix matching: "/issues" matches "/issues/123"
    return currentPath === allowed || currentPath.startsWith(allowed + "/")
  })
}
