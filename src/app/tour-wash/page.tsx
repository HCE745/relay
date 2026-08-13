"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Droplets, QrCode, Package, AlertCircle, Users, ChevronRight, Check,
  Loader2, Wrench, Shield, BarChart2,
} from "lucide-react"
import { RelayWordmarkWhite } from "@/components/logo"

const FEATURES = [
  {
    icon: QrCode,
    title: "Customer QR Reporting",
    description: "Customers scan a QR code at any bay or kiosk to report problems in seconds — no app download needed.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Package,
    title: "Equipment Asset Tracking",
    description: "Track every tunnel, vacuum, pay station, and chemical system. Know what's operational at a glance.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: AlertCircle,
    title: "Issue Management",
    description: "Log breakdowns, safety issues, and supply shortages. Auto-route to the right technician instantly.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: Users,
    title: "Multi-Location Teams",
    description: "Manage up to 7 locations with one account. Each site gets its own QR codes and issue queue.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Wrench,
    title: "Preventive Maintenance",
    description: "Schedule recurring PM checks for your tunnel equipment, RO system, and chemical dosing.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: BarChart2,
    title: "Operations Dashboard",
    description: "Daily snapshot of equipment status, customer reports, and open issues — all in one place.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
]

const PLANS = [
  {
    name: "Wash Essentials",
    price: "Coming soon",
    description: "Purpose-built for 1–7 location car washes.",
    highlights: [
      "QR customer reporting at every bay",
      "Equipment asset tracking",
      "Issue management & team assignments",
      "Up to 7 locations",
      "Vendor & maintenance tracking",
    ],
    cta: "Start Free Demo",
    ctaStyle: "bg-blue-600 hover:bg-blue-500 text-white",
    featured: true,
  },
  {
    name: "Full Relay — Wash Edition",
    price: "Standard Relay pricing",
    description: "The complete Relay platform configured for car wash operations.",
    highlights: [
      "Everything in Wash Essentials",
      "SOPs & workflows",
      "Advanced analytics",
      "AI-powered briefings",
      "API & webhook integrations",
    ],
    cta: "Explore Full Platform",
    ctaStyle: "bg-gray-700 hover:bg-gray-600 text-white",
    featured: false,
  },
]

export default function TourWashPage() {
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState("")

  async function launchDemo() {
    setLaunching(true)
    setLaunchError("")
    try {
      const gateRes = await fetch("/api/demo/gate")
      const gate = await gateRes.json() as { required: boolean }
      if (gate.required) {
        // Access code required — send to the general tour with car-wash pre-selected
        window.location.href = "/tour?industry=car-wash"
        return
      }

      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: "Car Wash" }),
      })
      if (!res.ok) {
        window.location.href = "/tour?industry=car-wash"
        return
      }
      window.location.href = "/dashboard?autoStartTour=1"
    } catch {
      setLaunchError("Could not start demo. Try again or visit /tour.")
      setLaunching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <RelayWordmarkWhite height={28} />
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-white text-gray-900 hover:bg-gray-100 font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
          <Droplets className="w-3.5 h-3.5" />
          Built for Car Washes
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
          Stop managing your car wash<br className="hidden md:block" />
          <span className="text-blue-400"> with paper and group texts.</span>
        </h1>

        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Relay gives your team one place to track equipment, receive customer reports via QR code,
          and keep every location running without the chaos.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => void launchDemo()}
            disabled={launching}
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-70 text-white font-bold rounded-2xl transition-colors text-sm"
          >
            {launching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting demo…</>
            ) : (
              <><Droplets className="w-4 h-4" /> See the Car Wash Demo</>
            )}
          </button>
          <Link
            href="/register"
            className="flex items-center gap-2 px-6 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-2xl transition-colors text-sm border border-gray-700"
          >
            Start free trial
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {launchError && (
          <p className="text-red-400 text-sm mt-4">{launchError}</p>
        )}

        <p className="text-gray-600 text-xs mt-5">No credit card required · Demo resets every 2 hours</p>
      </div>

      {/* Social proof strip */}
      <div className="border-t border-gray-800/60 bg-gray-900/40">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-8 text-center">
          {[
            { stat: "< 2 min", label: "Setup time per QR code" },
            { stat: "7 sites", label: "Max locations on Essentials" },
            { stat: "0 apps", label: "Customers need to download" },
            { stat: "100%", label: "Mobile-friendly" },
          ].map(({ stat, label }) => (
            <div key={label}>
              <div className="text-2xl font-black text-white">{stat}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Everything you need to run a tight operation</h2>
          <p className="text-gray-500 text-sm">No bloat. Just the tools car wash operators actually use.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description, color, bg }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* QR Reporting spotlight */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 border border-blue-800/30 rounded-3xl p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Shield className="w-3.5 h-3.5" />
                Customer QR Reporting
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Let customers report problems before they leave a bad review.
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Stick a Relay QR code on any bay, vacuum, or kiosk. When something breaks,
                customers tap to report it in 10 seconds. Your team gets notified instantly —
                no more discovering problems hours later.
              </p>
              <ul className="space-y-2">
                {[
                  "Large tap-target category buttons (no typing required)",
                  "Reports route to the right tech automatically",
                  "Optional contact info for follow-up",
                  "Photo attachment for faster diagnosis",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-sm text-gray-400 mb-4">Customer sees options like:</p>
              <div className="space-y-2 text-left">
                {[
                  "Not Working / Broken",
                  "Needs Cleaning / Maintenance",
                  "Safety Issue / Hazard",
                  "Needs Supplies",
                  "Something Else",
                ].map(opt => (
                  <div key={opt} className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-xl border border-gray-700 text-sm text-gray-200">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Two products. One platform.</h2>
          <p className="text-gray-500 text-sm">Start with what you need, upgrade when you&apos;re ready.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {PLANS.map(({ name, price, description, highlights, cta, ctaStyle, featured }) => (
            <div
              key={name}
              className={`rounded-2xl p-8 border ${
                featured
                  ? "bg-blue-900/20 border-blue-700/40"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              {featured && (
                <div className="inline-block text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2.5 py-1 rounded-full mb-3">
                  Recommended for small washes
                </div>
              )}
              <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
              <p className="text-xs text-gray-500 mb-1">{price}</p>
              <p className="text-sm text-gray-400 mb-6">{description}</p>
              <ul className="space-y-2 mb-8">
                {highlights.map(h => (
                  <li key={h} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
              <button
                onClick={name === "Wash Essentials" ? () => void launchDemo() : undefined}
                disabled={name === "Wash Essentials" && launching}
                className={`w-full py-3 font-semibold rounded-xl transition-colors text-sm ${ctaStyle} disabled:opacity-70`}
              >
                {name === "Wash Essentials" && launching ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Starting…</span>
                ) : (
                  <Link
                    href={name === "Wash Essentials" ? "#" : "/tour?industry=car-wash"}
                    onClick={name === "Wash Essentials" ? (e) => { e.preventDefault(); void launchDemo() } : undefined}
                    className="block w-full"
                  >
                    {cta}
                  </Link>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-gray-800 bg-gray-900/40">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to run a tighter operation?</h2>
          <p className="text-gray-500 text-sm mb-8">
            Start your free 14-day trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/register?industry=car_wash`}
              className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-colors text-sm"
            >
              <Droplets className="w-4 h-4" />
              Start Free Trial
            </Link>
            <button
              onClick={() => void launchDemo()}
              disabled={launching}
              className="flex items-center gap-2 px-6 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-2xl transition-colors text-sm border border-gray-700 disabled:opacity-70"
            >
              {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              See the Demo First
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
