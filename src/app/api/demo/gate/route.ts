import { NextResponse } from "next/server"
import { getPlatformConfig } from "@/lib/platform-config"

// Public endpoint — tells the /demo page whether an access code is required.
// Never returns the actual code.
export async function GET() {
  const code = await getPlatformConfig("demo_access_code")
  return NextResponse.json({ required: code.length > 0 })
}
