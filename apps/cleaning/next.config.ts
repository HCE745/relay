import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
  // Pin the monorepo root so Next doesn't infer it from a stray lockfile.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // Compile the shared workspace TypeScript packages from source.
  transpilePackages: ["@hce/ui", "@hce/auth"],
}

export default nextConfig
