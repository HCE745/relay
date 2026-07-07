import { Lock } from "lucide-react"

export function FeatureFlagGate({
  featureName,
  description,
}: {
  featureName: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
        <Lock className="w-6 h-6 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{featureName}</h2>
      <p className="text-gray-500 text-sm max-w-sm mb-4">
        {description ?? "This feature is part of the Professional Plus add-on package."}
      </p>
      <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
        Contact your Relay administrator or{" "}
        <a href="mailto:support@getrelay.software" className="text-indigo-600 hover:underline">
          support@getrelay.software
        </a>{" "}
        to enable this feature.
      </p>
    </div>
  )
}
