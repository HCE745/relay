#!/usr/bin/env node

const fs   = require("fs")
const path = require("path")
const https= require("https")

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID
const API_KEY  = process.env.ELEVENLABS_API_KEY

if (!API_KEY)  { console.error("Missing ELEVENLABS_API_KEY"); process.exit(1) }
if (!VOICE_ID) { console.error("Missing ELEVENLABS_VOICE_ID"); process.exit(1) }

const OUT_DIR = path.join(__dirname, "..", "public", "demo-audio")
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// Manufacturing-specific narrations used as default audio
const STEPS = [
  {
    id: 1,
    text: "Operational problems rarely become serious all at once. They start small — a machine fault mentioned during shift change but never logged, a hydraulic issue texted to a supervisor who forgets to document it, a recurring failure that everyone knows about but no one has formally tracked. By the time it causes unplanned downtime, no one can trace when it started. Relay gives manufacturing teams a shared system to make those problems visible and keep them moving toward resolution.",
  },
  {
    id: 2,
    text: "When problems are tracked across radios, texts, and verbal handoffs, plant managers spend their time chasing updates instead of solving problems. This dashboard gives operators and leadership a single view of what is open, what is overdue, and what needs attention right now — across every department and every shift.",
  },
  {
    id: 3,
    text: "Operators notice equipment problems before management does — but reporting usually depends on finding the right supervisor or hoping someone follows up. With Relay, anyone on the plant floor can document a hydraulic leak, machine fault, or quality defect in seconds — with photos, location, and priority — and know the right person has been notified.",
  },
  {
    id: 4,
    text: "Once reported, the issue does not sit in a queue waiting for someone to assign it. Relay routes it instantly to the right technician or supervisor based on location, department, and issue type — before anyone has to make a call.",
  },
  {
    id: 5,
    text: "When problems get resolved through verbal updates, the resolution disappears with them. Relay keeps a complete record of every action — who reported it, who owned it, every status change, every comment. When the same issue comes back, the full history is already there.",
  },
  {
    id: 6,
    text: "Most plant issues get reviewed for the first time by the person resolving them — which means the same diagnostic steps happen over and over. Relay's AI suggests likely causes and recommended actions based on the description, the equipment, and historical patterns. Your team still makes every decision — they just start from a better position.",
  },
  {
    id: 7,
    text: "Some machine failures are symptoms of a missed procedure. When a fault occurs repeatedly in the same production area, it may indicate a gap in the standard process — not just a one-time breakdown. Relay can flag when a reported issue may be connected to an existing operating procedure, so teams address the root cause instead of simply closing the ticket.",
  },
  {
    id: 8,
    text: "When the same conveyor or hydraulic press keeps generating issues, treating each incident as isolated misses the pattern. Relay tracks the full history of every piece of equipment — every issue reported, every repair completed, every recurring failure — so teams can see whether a problem needs another repair or a replacement before it causes a production stoppage.",
  },
  {
    id: 9,
    text: "Data collected during shifts becomes operational intelligence over time. Which production area generates the most issues? Which equipment has the worst resolution time? Where are problems recurring shift after shift? Relay turns issue history into answers — without requiring anyone to build a report.",
  },
  {
    id: 10,
    text: "How does your plant compare to similar manufacturing operations? Relay can benchmark your resolution times, issue volume, and response rates against anonymized data from similar facilities — so you know where you stand and where there is room to improve.",
  },
  {
    id: 11,
    text: "Place a Relay QR code on any machine, near the hydraulic station, at each dock bay. Anyone on the floor can scan and report a problem in seconds — no account, no app required. The report goes directly to the right team and links automatically to that asset or location.",
  },
  {
    id: 12,
    text: "When equipment needs an outside service contractor, coordinating the response usually means phone calls, follow-up to confirm arrival, and hoping the right context made it through. Relay keeps vendor communication attached to the issue — so the full history travels with it and nothing gets lost between inboxes.",
  },
  {
    id: 13,
    text: "Replacing a conveyor belt or hydraulic seal kit should not require the same process as a capital expenditure. Relay identifies the requested item, checks it against the approved catalog, and follows the organization's purchasing policy — approving routine requests automatically and escalating exceptions to the right approver.",
  },
  {
    id: 14,
    text: "Some issues stay unresolved because the responsible person is overloaded or a deadline slips unnoticed. Relay escalates automatically when response or resolution timelines are missed — and leadership gets a real-time view across every location and shift without needing to ask for a status report.",
  },
  {
    id: 15,
    text: "A machine fault identifies the problem. An assignment turns it into work. Managers can create specific assignments — shut down the equipment, contact the service contractor, order the replacement part. Every piece of work has a clear owner, a priority, a due date, and a direct link back to the issue that triggered it. Nothing gets lost, and nothing gets forgotten.",
  },
  {
    id: 16,
    text: "An operator starting a shift should not have to ask what needs to get done. When they open Relay, they see exactly what is assigned to them — what is due today, what is overdue, what is urgent. A clear answer to the only question that matters: what do I need to do right now?",
  },
  {
    id: 17,
    text: "When a safety update or process change needs to reach everyone on the floor, radio announcements and group texts do not guarantee it arrived. Relay broadcasts operational announcements to the entire plant, a specific shift, or a single department. For critical communications, Relay tracks acknowledgment in real time — so you always know who has seen the message and who has not.",
  },
  {
    id: 18,
    text: "Every role sees what they need. An operator needs to know what to report. A supervisor needs their team's queue. A plant manager needs location-wide visibility. An administrator needs full control over configuration. Relay adapts to each role automatically — one system, every level of the organization.",
  },
  {
    id: 19,
    text: "Relay adapts to different types of operations — manufacturing plants, distribution centers, hospitality properties, retail locations, healthcare facilities, and more. The departments, terminology, issue categories, and workflows all reflect the selected environment — so the system feels built for the operation it runs.",
  },
  {
    id: 20,
    text: "As operations grow, Relay grows with them. Essentials covers core issue tracking for a single location. Professional adds assets, vendors, multi-location support, and intelligence modules. Professional Plus adds executive visibility, regional management, and cross-location analytics. Choose the package that matches your operational needs today.",
  },
  {
    id: 21,
    text: "Relay helps manufacturing organizations replace fragmented workarounds with a shared operational system. Operators have a clear way to report problems. Supervisors have ownership and accountability. Leadership has visibility. That means fewer problems lost between shifts, clearer maintenance coordination, and earlier visibility into the issues contributing to downtime or quality loss. Continue exploring, start a free trial, or schedule a personalized demonstration. Thanks for taking the tour.",
  },
]

function generate(step) {
  return new Promise((resolve, reject) => {
    const fileName = `step-${String(step.id).padStart(2, "0")}.mp3`
    const filePath = path.join(OUT_DIR, fileName)

    const body = JSON.stringify({
      text: step.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability:        0.15,
        similarity_boost: 0.85,
        style:            0.75,
        use_speaker_boost: true,
      },
    })

    const options = {
      hostname: "api.elevenlabs.io",
      path:     `/v1/text-to-speech/${VOICE_ID}`,
      method:   "POST",
      headers: {
        "xi-api-key":    API_KEY,
        "Content-Type":  "application/json",
        "Content-Length": Buffer.byteLength(body),
        Accept:          "audio/mpeg",
      },
    }

    const req = https.request(options, res => {
      if (res.statusCode !== 200) {
        let err = ""
        res.on("data", d => (err += d))
        res.on("end", () => reject(new Error(`ElevenLabs ${res.statusCode}: ${err}`)))
        return
      }
      const chunks = []
      res.on("data", chunk => chunks.push(chunk))
      res.on("end", () => {
        fs.writeFileSync(filePath, Buffer.concat(chunks))
        console.log(`✓ ${fileName}`)
        resolve()
      })
    })

    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  const existing = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".mp3"))
  for (const f of existing) {
    fs.unlinkSync(path.join(OUT_DIR, f))
    console.log(`✗ deleted ${f}`)
  }
  console.log()

  console.log(`Generating ${STEPS.length} audio clips → ${OUT_DIR}\n`)
  for (const step of STEPS) {
    try {
      await generate(step)
    } catch (err) {
      console.error(`✗ step-${String(step.id).padStart(2, "0")}.mp3:`, err.message)
    }
  }
  console.log("\nDone.")
}

main()
