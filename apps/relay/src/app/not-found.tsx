import Link from "next/link"
import { RelayWordmark } from "@/components/logo"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="text-center max-w-md w-full">
        <div className="flex justify-center mb-8">
          <RelayWordmark height={36} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
          <p className="text-7xl font-bold text-gray-200 mb-4 leading-none">404</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
