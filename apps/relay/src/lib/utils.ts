// Re-export shim — cn now lives in the shared @hce/ui package.
// Imported from the /utils subpath so this (pervasively-imported, server-safe)
// module never pulls in the package's client components.
export { cn } from "@hce/ui/utils"
