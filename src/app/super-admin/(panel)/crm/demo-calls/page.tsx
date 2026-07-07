import { DemoCallsClient } from "./demo-calls-client"

export default function DemoCallsPage() {
  const schedulingUrl = process.env.CALENDLY_SCHEDULING_URL ?? null
  return <DemoCallsClient schedulingUrl={schedulingUrl} />
}
