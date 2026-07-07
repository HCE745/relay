"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Scene data
// ─────────────────────────────────────────────────────────────────────────────

interface Scene {
  id: number
  url: string | null
  duration: number
  audio: string
  type: "intro" | "page" | "outro"
  title?: string
  subtitle?: string
  highlight?: string   // comma-separated CSS selectors — tried in order
}

function buildScenes(issueUrl: string): Scene[] {
  return [
    {
      id: 1, url: null, duration: 8000,
      audio: "/demo-video-audio/step-01.mp3", type: "intro",
    },
    {
      id: 2, url: "/dashboard", duration: 14000,
      audio: "/demo-video-audio/step-02.mp3", type: "page",
      title: "Command Center",
      subtitle: "Open issues, escalations, and performance across your entire operation.",
      highlight: '[data-tour="kpi-cards"],[class*="kpi"],[class*="stat-card"],[class*="metric-card"]',
    },
    {
      id: 3, url: "/issues", duration: 16000,
      audio: "/demo-video-audio/step-03.mp3", type: "page",
      title: "Issue Tracking",
      subtitle: "Every issue has an owner, a priority, and a complete history.",
      highlight: 'table,[role="table"],[class*="issue-list"]',
    },
    {
      id: 4, url: issueUrl, duration: 20000,
      audio: "/demo-video-audio/step-04.mp3", type: "page",
      title: "Full Accountability",
      subtitle: "Every action tracked from first report to final resolution.",
      highlight: '[class*="activity"],[class*="timeline"],[class*="history-"]',
    },
    {
      id: 5, url: issueUrl, duration: 20000,
      audio: "/demo-video-audio/step-05.mp3", type: "page",
      title: "Issue Intelligence",
      subtitle: "AI suggests causes, actions, and solutions before your team even asks.",
      highlight: '[class*="ai-"],[class*="intelligence"],[class*="suggest"]',
    },
    {
      id: 6, url: issueUrl, duration: 12000,
      audio: "/demo-video-audio/step-06.mp3", type: "page",
      title: "SOP Compliance",
      subtitle: "Relay flags when an issue may be connected to a missed procedure.",
      highlight: '[class*="sop"],[class*="procedure"],[class*="violation"]',
    },
    {
      id: 7, url: "/assets", duration: 18000,
      audio: "/demo-video-audio/step-07.mp3", type: "page",
      title: "Asset History",
      subtitle: "Every piece of equipment has a complete record of issues and maintenance.",
      highlight: 'table tbody tr:first-child,[class*="asset-row"]:first-child',
    },
    {
      id: 8, url: "/analytics", duration: 14000,
      audio: "/demo-video-audio/step-08.mp3", type: "page",
      title: "Operational Intelligence",
      subtitle: "Trends, bottlenecks, and industry benchmarks built from your data.",
      highlight: '[class*="chart"],canvas,[class*="trend-"]',
    },
    {
      id: 9, url: "/qr-codes", duration: 16000,
      audio: "/demo-video-audio/step-09.mp3", type: "page",
      title: "QR Reporting",
      subtitle: "Scan. Describe. Submit. No app or account required.",
      highlight: 'table,[class*="qr-list"],[class*="code-list"]',
    },
    {
      id: 10, url: "/purchase-requests", duration: 16000,
      audio: "/demo-video-audio/step-10.mp3", type: "page",
      title: "Purchase Intelligence",
      subtitle: "Routine replacements approved automatically. No bureaucracy.",
      highlight: 'table,[class*="request-row"],[class*="purchase-row"]',
    },
    {
      id: 11, url: "/dashboard", duration: 14000,
      audio: "/demo-video-audio/step-11.mp3", type: "page",
      title: "Executive Visibility",
      subtitle: "Health scores, regional performance, and AI briefings for leadership.",
      highlight: '[class*="executive"],[class*="health-score"],[class*="regional"]',
    },
    {
      id: 12, url: null, duration: 12000,
      audio: "/demo-video-audio/step-12.mp3", type: "outro",
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — no React dependencies
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function waitLoad(iframe: HTMLIFrameElement, ms = 10000): Promise<void> {
  return new Promise(res => {
    const tid = setTimeout(res, ms)
    iframe.addEventListener("load", () => { clearTimeout(tid); res() }, { once: true })
  })
}

function queryRect(iframe: HTMLIFrameElement, selector: string): DOMRect | null {
  try {
    const doc = iframe.contentDocument
    if (!doc) return null
    for (const s of selector.split(",")) {
      try {
        const el = doc.querySelector(s.trim())
        if (el) {
          const r = el.getBoundingClientRect()
          if (r.width > 20 && r.height > 10) return r
        }
      } catch { /* ignore bad selectors */ }
    }
  } catch { /* cross-origin guard */ }
  return null
}

function scrollToElement(iframe: HTMLIFrameElement, selector: string): boolean {
  try {
    const win = iframe.contentWindow as (Window & { __vdScrollTo?: (s: string) => boolean })
    return win.__vdScrollTo?.(selector) ?? false
  } catch { return false }
}

// Inject helpers into iframe on first load — safe to call multiple times
function injectHelpers(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument
    const win = iframe.contentWindow as (Window & { __vdOk?: boolean })
    if (!doc || !win || win.__vdOk) return
    win.__vdOk = true

    // Hide demo mode UI artifacts
    const style = doc.createElement("style")
    style.textContent = `
      [data-demo-panel],[class*="demo-tour-host"],[class*="impersonation-banner"],
      [class*="support-button"] { display: none !important; }
    `
    doc.head?.appendChild(style)

    // Name replacement + scroll helper
    const script = doc.createElement("script")
    script.textContent = `
;(function() {
  function walk(n) {
    if (n.nodeType === 3) {
      n.textContent = n.textContent
        .replace(/Demo Admin/g, 'James Wilson')
        .replace(/Good morning, Demo/g, 'Good morning, James')
        .replace(/admin@demo\\S*/g, 'james.wilson@acme.com');
    } else {
      Array.from(n.childNodes).forEach(walk);
    }
  }
  walk(document.body);
  document.querySelectorAll('[class*="rounded-full"]').forEach(function(e) {
    if ((e.textContent || '').trim() === 'D') e.textContent = 'J';
  });

  window.__vdScrollTo = function(selector) {
    var parts = selector.split(',');
    for (var i = 0; i < parts.length; i++) {
      try {
        var el = document.querySelector(parts[i].trim());
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
      } catch(err) {}
    }
    return false;
  };
})();
`
    doc.head?.appendChild(script)
  } catch (e) {
    console.log("[vd] inject err", e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface LowerThird { title: string; subtitle: string; visible: boolean }
interface SpotRect { left: number; top: number; right: number; bottom: number }

export default function DemoVideoPage() {
  const iframeRef   = useRef<HTMLIFrameElement>(null)
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const startedRef  = useRef(false)

  // Minimal rendering state
  const [phase,   setPhase]   = useState<"loading" | "intro" | "page" | "outro">("loading")
  const [curtain, setCurtain] = useState(true)    // true = dark overlay visible
  const [lt,      setLt]      = useState<LowerThird | null>(null)
  const [spot,    setSpot]    = useState<SpotRect | null>(null)

  useEffect(() => {
    // Strict Mode double-invoke guard
    if (startedRef.current) return
    startedRef.current = true
    document.cookie = "relay-vd=1; path=/; max-age=7200; SameSite=Lax"

    function playAudio(src: string) {
      audioRef.current?.pause()
      const a = new Audio(src)
      audioRef.current = a
      a.play().catch(() => {})
    }

    function stopAudio() {
      audioRef.current?.pause()
      audioRef.current = null
    }

    async function run() {
      console.log("[vd] starting")

      // Brief dark screen — no text, no countdown
      await sleep(1000)

      // Create demo session
      try {
        const r = await fetch("/api/demo/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ superAdminBypass: true, industry: "Manufacturing" }),
          credentials: "include",
        })
        console.log("[vd] session", r.status)
      } catch (e) { console.log("[vd] session err", e) }

      // Find first issue for detail scenes
      let issueUrl = "/issues"
      try {
        const r    = await fetch("/api/issues", { credentials: "include" })
        const data = await r.json()
        const list = Array.isArray(data) ? data : (data.issues ?? data.data ?? [])
        if (list[0]?.id) issueUrl = `/issues/${list[0].id}`
      } catch {}
      console.log("[vd] issueUrl:", issueUrl)

      const scenes = buildScenes(issueUrl)
      let curUrl   = ""

      for (const scene of scenes) {
        console.log(`[vd] ▶ scene ${scene.id} (${scene.type})`)

        // ── INTRO ─────────────────────────────────────────────────────────
        if (scene.type === "intro") {
          setPhase("intro")
          setCurtain(false)
          playAudio(scene.audio)
          await sleep(scene.duration)
          setCurtain(true); stopAudio(); await sleep(400)
          continue
        }

        // ── OUTRO ─────────────────────────────────────────────────────────
        if (scene.type === "outro") {
          setLt(null); setSpot(null)
          setPhase("outro"); setCurtain(false)
          playAudio(scene.audio)
          await sleep(scene.duration)
          stopAudio()
          continue
        }

        // ── PAGE SCENE ────────────────────────────────────────────────────
        const iframe = iframeRef.current!

        // Navigate only when URL changes (curtain is opaque — user sees nothing)
        if (scene.url !== curUrl) {
          console.log(`[vd] nav → ${scene.url}`)
          iframe.src = scene.url!
          curUrl = scene.url!
          await waitLoad(iframe)
          await sleep(1200)     // hydration settle
          injectHelpers(iframe)
        }

        // Scroll to highlight target while page is hidden
        let spotRect: SpotRect | null = null
        if (scene.highlight) {
          const found = scrollToElement(iframe, scene.highlight)
          if (found) await sleep(700)    // let smooth scroll finish
          const r = queryRect(iframe, scene.highlight)
          if (r) {
            spotRect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
            console.log(`[vd] spotlight: ${scene.highlight}`)
          } else {
            console.log(`[vd] no element: ${scene.highlight}`)
          }
        }

        // Reveal page
        setPhase("page")
        setSpot(spotRect)
        setCurtain(false)
        await sleep(400)    // curtain fade completes

        // Lower third — fade in
        if (scene.title) {
          const ltNow = { title: scene.title, subtitle: scene.subtitle ?? "", visible: false }
          setLt(ltNow)
          await sleep(50)
          setLt({ ...ltNow, visible: true })
        }

        // Audio starts with the scene reveal
        playAudio(scene.audio)

        // Hold for scene duration
        await sleep(scene.duration)

        // Lower third — fade out before transitioning
        if (scene.title) {
          setLt(prev => prev ? { ...prev, visible: false } : null)
          await sleep(300)
        }

        // Dark curtain before next scene
        setSpot(null)
        setCurtain(true); stopAudio(); await sleep(400)
      }

      console.log("[vd] all scenes done")
    }

    run()
  }, []) // intentionally empty — fires once on mount

  // Build SVG clip-path: full-screen rectangle with rectangular hole at spotlight
  const spotPath = spot
    ? `M0,0 H3000 V3000 H0 Z ` +
      `M${spot.left - 8},${spot.top - 8} ` +
      `H${spot.right + 8} V${spot.bottom + 8} ` +
      `H${spot.left - 8} Z`
    : null

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#09162e",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>

      {/* App content lives here */}
      <iframe
        ref={iframeRef}
        src="about:blank"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        title="Relay Demo"
      />

      {/* Spotlight — dark overlay with clip-path hole revealing the target element */}
      {spotPath && (
        <>
          <svg style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}>
            <defs>
              <clipPath id="vd-clip" clipPathUnits="userSpaceOnUse">
                <path fillRule="evenodd" d={spotPath} />
              </clipPath>
            </defs>
          </svg>
          <div
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.55)",
              clipPath: "url(#vd-clip)",
              zIndex: 60,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Lower third — professional product video style */}
      {lt && (
        <div
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: 70,
            padding: "40px 72px 52px",
            background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0) 100%)",
            opacity: lt.visible ? 1 : 0,
            transition: "opacity 300ms ease",
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "white", fontSize: 30, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 6 }}>
            {lt.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 16, lineHeight: 1.5 }}>
            {lt.subtitle}
          </div>
        </div>
      )}

      {/* Scene overlays — sit above spotlight/lower-third, below dark curtain */}
      {phase === "intro" && <IntroOverlay />}
      {phase === "outro" && <OutroOverlay />}

      {/* Dark curtain — covers everything between scenes */}
      <div
        style={{
          position: "fixed", inset: 0,
          background: "#09162e",
          zIndex: 90,
          opacity: curtain ? 1 : 0,
          transition: "opacity 400ms ease",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Intro screen — Scene 1
// ─────────────────────────────────────────────────────────────────────────────

function IntroOverlay() {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVis(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#09162e", zIndex: 80,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: vis ? 1 : 0, transition: "opacity 800ms ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 48px rgba(59,130,246,0.35)",
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span style={{ color: "white", fontSize: 36, fontWeight: 700, letterSpacing: "-0.5px" }}>
          Relay
        </span>
      </div>

      <h1 style={{
        color: "white", fontSize: 44, fontWeight: 700, textAlign: "center",
        maxWidth: 640, lineHeight: 1.12, letterSpacing: "-1px", margin: "0 0 20px",
      }}>
        Never let issues fall<br />through the cracks.
      </h1>

      <p style={{
        color: "rgba(255,255,255,0.5)", fontSize: 18, textAlign: "center",
        maxWidth: 520, lineHeight: 1.65, margin: 0,
      }}>
        One system to report, route, track, and resolve<br />
        operational issues — for every team, every shift.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Outro screen — Scene 12
// ─────────────────────────────────────────────────────────────────────────────

function OutroOverlay() {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVis(true), 200)
    return () => clearTimeout(t)
  }, [])

  const fade = (delay: number): CSSProperties => ({
    opacity: vis ? 1 : 0,
    transform: vis ? "translateY(0)" : "translateY(20px)",
    transition: `opacity 600ms ease ${delay}ms, transform 600ms ease ${delay}ms`,
  })

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(160deg, #07142a 0%, #0b1f3a 60%, #09162e 100%)",
      zIndex: 80,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "0 32px",
    }}>

      {/* Wordmark */}
      <div style={{ ...fade(0), display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(59,130,246,0.3)",
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span style={{ color: "white", fontSize: 32, fontWeight: 700 }}>Relay</span>
      </div>

      {/* Headline */}
      <h1 style={{
        ...fade(120),
        color: "white", fontSize: 52, fontWeight: 700,
        textAlign: "center", lineHeight: 1.1, letterSpacing: "-1.5px", margin: "0 0 24px",
      }}>
        Every issue.<br />One owner.<br />Full visibility.
      </h1>

      {/* Accent */}
      <div style={{ ...fade(240), width: 48, height: 3, background: "#3b82f6", borderRadius: 2, marginBottom: 24 }} />

      {/* URL */}
      <p style={{
        ...fade(340),
        color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 600,
        letterSpacing: "0.3px", margin: "0 0 40px",
      }}>
        getrelay.software
      </p>

      {/* CTAs */}
      <div style={{ ...fade(460), display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { label: "Start Free Trial", primary: true },
          { label: "Try Interactive Demo", primary: false },
          { label: "Book a Demo", primary: false },
        ].map(btn => (
          <div key={btn.label} style={{
            padding: "13px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "default",
            background: btn.primary ? "#2563eb" : "transparent",
            color:      btn.primary ? "white" : "rgba(255,255,255,0.72)",
            border:     btn.primary ? "2px solid #2563eb" : "2px solid rgba(255,255,255,0.2)",
          }}>
            {btn.label}
          </div>
        ))}
      </div>
    </div>
  )
}
