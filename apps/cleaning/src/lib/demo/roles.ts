// Demo role constants. Kept in a plain module (NOT the "use server" actions
// file, which may only export async functions) so both the server action and
// the client picker can import them.
export const DEMO_ROLES = ["OWNER", "MANAGER", "SUPERVISOR", "CLEANER"] as const
export type DemoRole = (typeof DEMO_ROLES)[number]
