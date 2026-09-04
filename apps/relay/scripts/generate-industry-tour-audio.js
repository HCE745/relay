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

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Car Wash (20 steps) ────────────────────────────────────────────────────────

const CARWASH_STEPS = [
  {
    id: 1,
    text: "Running a car wash means keeping equipment working, customers moving, and problems from becoming lost revenue. Whether you operate self-service bays, in-bay automatics, or tunnels, Relay gives your team one place to catch problems, assign responsibility, and keep every site running.",
  },
  {
    id: 2,
    text: "Start with the Wash Overview. Before the day gets busy, managers can see which bays and equipment are operational, what's down, and where open problems need attention.",
  },
  {
    id: 3,
    text: "Your customers can become an extra set of eyes. If a vacuum loses suction, a pay station fails, or a bay isn't working correctly, they can report it immediately and send the problem directly to your team.",
  },
  {
    id: 4,
    text: "Relay QR codes make reporting almost effortless. The customer scans the code, selects what went wrong, and submits. Relay already knows the location and equipment, so there's no app to download and no account to create.",
  },
  {
    id: 5,
    text: "Your employees can report problems just as quickly. Here, we're logging a high-pressure rinse problem on Bay Three. In seconds, an equipment failure becomes a trackable operational issue instead of something mentioned in passing.",
  },
  {
    id: 6,
    text: "Customer reports and employee reports come together in one queue. Managers can immediately see the site, equipment, priority, category, and status without piecing information together from calls, texts, and conversations.",
  },
  {
    id: 7,
    text: "Now the problem gets an owner. Assign it to the right technician, and everyone can see who is responsible, what needs attention, and where the issue stands.",
  },
  {
    id: 8,
    text: "Relay can also help your team evaluate an equipment problem. Its AI analysis provides additional context and recommended next steps from the information available on the issue, giving the technician a useful starting point before beginning the repair.",
  },
  {
    id: 9,
    text: "Not every problem deserves the same response. When equipment goes completely down, Relay makes that failure highly visible, along with the affected equipment, reporting history, priority, and time outstanding.",
  },
  {
    id: 10,
    text: "And when an important problem sits unresolved, Relay can escalate it through the organization. Management gets visibility without relying on someone to remember to make another call or send another text.",
  },
  {
    id: 11,
    text: "Every major piece of wash equipment can have its own record in Relay — from pumps and pay stations to vacuums and tunnel equipment. Open issue counts make it easy to see where attention is accumulating.",
  },
  {
    id: 12,
    text: "Open an equipment record and you get its operational history. Recurring failures stop looking like isolated incidents, helping you decide whether to repair something again, investigate the underlying problem, or consider replacement.",
  },
  {
    id: 13,
    text: "Reactive repairs and ongoing maintenance stay visible together. Filter changes, pump lubrication, inspections, and other recurring work don't have to depend on somebody remembering them.",
  },
  {
    id: 14,
    text: "When outside service is required, Relay keeps the vendor connected to the work. Your team has the issue and equipment history in one place instead of rebuilding the story every time a specialist gets involved.",
  },
  {
    id: 15,
    text: "For multi-site operators, the same system extends across the entire business. Managers can see problems, maintenance, and equipment by location without physically checking every wash.",
  },
  {
    id: 16,
    text: "Technicians get a clear list of their work. They know what needs attention, where it is, and what takes priority — making shift handoffs much less dependent on memory and verbal communication.",
  },
  {
    id: 17,
    text: "Relay also gives management a direct channel across locations. Important operational or safety announcements can reach the people who need them, with acknowledgment available for communications that cannot be missed.",
  },
  {
    id: 18,
    text: "As Relay builds history, individual problems become operational intelligence. You can identify recurring equipment trouble, compare locations, and use actual operating history to make better maintenance and replacement decisions.",
  },
  {
    id: 19,
    text: "And the people working at your sites can contribute more than repair reports. Employee Voice gives them a structured way to surface concerns, suggestions, and recurring problems management might otherwise never see.",
  },
  {
    id: 20,
    text: "That's Relay for Car Wash: one operational system for equipment problems, customer reports, maintenance, assignments, and multi-site visibility. Smaller operators can start with Wash Essentials, while larger organizations can use the complete Relay Wash Edition.",
  },
]

// ── Property Management (20 steps) ────────────────────────────────────────────

const PROPERTY_STEPS = [
  {
    id: 1,
    text: "A tenant reports water coming through the ceiling. Maintenance thinks someone else has it. Three hours later, nobody has responded. Relay replaces those communication gaps with one operational system for requests, maintenance, equipment, contractors, and properties.",
  },
  {
    id: 2,
    text: "Start with the Property Overview. Managers can immediately see open property issues, new tenant requests, maintenance work, equipment requiring attention, and high-priority problems across the portfolio.",
  },
  {
    id: 3,
    text: "Relay also gives you visibility into building equipment. HVAC systems, boilers, elevators, fire systems, and other assets can be tracked across properties so maintenance teams know where attention is needed.",
  },
  {
    id: 4,
    text: "Tenants get a simple way to report problems directly to the people responsible for solving them. Their request enters Relay with its location attached instead of disappearing into an inbox or voicemail.",
  },
  {
    id: 5,
    text: "With QR reporting, there's no app and no account required. A tenant scans, describes the problem, and submits. Relay can associate that report with the appropriate property and location from the beginning.",
  },
  {
    id: 6,
    text: "Your own staff can report problems the same way. Here, we're documenting water damage in Unit Four-B, turning something discovered on-site into a visible, trackable issue immediately.",
  },
  {
    id: 7,
    text: "Tenant requests, staff reports, and maintenance issues come together in one queue. Property managers and maintenance supervisors work from the same operational picture instead of separate systems.",
  },
  {
    id: 8,
    text: "Every request gets a clear owner. Assign the work to maintenance or coordinate outside service, and the team can see who is responsible and what has happened since the request was submitted.",
  },
  {
    id: 9,
    text: "For maintenance problems, Relay's AI analysis can provide additional context and suggested next steps from the information available on the issue, helping the team evaluate the problem before arriving on site.",
  },
  {
    id: 10,
    text: "High-impact problems need to stand apart from routine requests. Relay keeps critical issues visible so water damage, equipment failures, and other urgent situations don't sit unnoticed in a general queue.",
  },
  {
    id: 11,
    text: "If an important request isn't addressed within its response window, Relay can escalate it through management automatically. The complete history stays attached, so the next person has context immediately.",
  },
  {
    id: 12,
    text: "Every major building asset can have its own Relay record. Open problems stay connected to the equipment they affect, giving technicians and managers a consistent history across the portfolio.",
  },
  {
    id: 13,
    text: "That history becomes especially valuable when the same HVAC unit, elevator, or boiler keeps failing. Relay makes recurring problems visible so repair-versus-replacement decisions aren't based on memory.",
  },
  {
    id: 14,
    text: "Maintenance work stays organized in one place. Reactive tenant problems and planned maintenance can be managed together, giving supervisors a clear picture of what is open and what needs attention.",
  },
  {
    id: 15,
    text: "When outside contractors are needed, Relay keeps them connected to the work and its context. The property, issue, and equipment history remain together instead of being repeatedly reconstructed over calls and emails.",
  },
  {
    id: 16,
    text: "For larger portfolios, Relay connects the operation across properties and buildings. Managers can see where problems are concentrated and where maintenance resources are being consumed.",
  },
  {
    id: 17,
    text: "Maintenance technicians get a straightforward view of what they own: the property, location, problem, priority, and work due. That makes daily work and shift handoffs much clearer.",
  },
  {
    id: 18,
    text: "Over time, Relay turns work history into management information. Recurring property problems, equipment failures, response performance, and maintenance patterns become easier to identify and act on.",
  },
  {
    id: 19,
    text: "Your maintenance team often sees patterns before management does. Employee Voice gives those employees a structured way to surface recurring problems, concerns, and ideas from across the portfolio.",
  },
  {
    id: 20,
    text: "That's Relay for Property Management: tenant requests, maintenance, equipment, assignments, contractors, and portfolio visibility in one operational system. Your team gets clearer accountability, while management gets a complete picture across every property.",
  },
]

// ── Manufacturing (21 steps) ───────────────────────────────────────────────────

const MANUFACTURING_STEPS = [
  {
    id: 1,
    text: "A machine goes down during one shift. Someone mentions it during handoff. The next shift assumes maintenance already knows. Relay closes that gap by giving operators, maintenance, supervisors, and plant management one shared operational system.",
  },
  {
    id: 2,
    text: "Start with the Plant Overview. Before the shift gets underway, supervisors can see equipment down, safety issues, maintenance work, high-priority problems, and the current state of the operation.",
  },
  {
    id: 3,
    text: "The Machine Status board shows which equipment is operational and which machines need attention. Open issues stay connected to the equipment itself, giving maintenance supervisors a quick view of where problems are accumulating.",
  },
  {
    id: 4,
    text: "When something goes wrong on the floor, it can be logged immediately — from Relay, from a machine QR code, or directly by a technician. The problem becomes visible while it is happening, not at the next shift meeting.",
  },
  {
    id: 5,
    text: "Here, an operator reports spindle vibration on CNC Machine Three. In a few seconds, an observation from the floor becomes a documented equipment issue that maintenance can act on.",
  },
  {
    id: 6,
    text: "Breakdowns, maintenance requests, safety concerns, and quality problems come together in one operational queue. Supervisors can prioritize and coordinate the work without chasing information across departments.",
  },
  {
    id: 7,
    text: "Once the issue is logged, give it a clear owner. The assigned technician gets the machine, problem, priority, and issue history, while supervisors can see exactly who is responsible.",
  },
  {
    id: 8,
    text: "Relay's AI analysis can provide additional context and suggested next steps from the information available on the equipment issue. That gives maintenance a useful starting point before troubleshooting begins.",
  },
  {
    id: 9,
    text: "The procedure belongs with the work. Relevant safety instructions and SOPs can be connected to the issue so technicians don't have to hunt through binders or disconnected systems before beginning the job.",
  },
  {
    id: 10,
    text: "A machine-down event isn't the same as a routine request. Relay makes production-critical problems visible along with the affected machine, priority, history, and time outstanding.",
  },
  {
    id: 11,
    text: "If a critical issue isn't addressed within its response window, Relay can escalate it to the appropriate management level. Problems don't have to wait for the next production meeting to get attention.",
  },
  {
    id: 12,
    text: "Every major machine can have its own operational record — from CNC equipment and presses to robots, conveyors, cranes, compressors, and plant systems. Maintenance sees where open problems are concentrated.",
  },
  {
    id: 13,
    text: "Open the machine and its history follows it. Repeated breakdowns, maintenance work, and previous repairs give supervisors better information about recurring failures and future equipment decisions.",
  },
  {
    id: 14,
    text: "Put a Relay QR code directly on the machine or work cell. An operator can scan it where the problem occurs, report what's wrong, and create an equipment-linked issue without leaving the floor.",
  },
  {
    id: 15,
    text: "Relay keeps operating and safety procedures where the team can actually use them. LOTO instructions, inspections, and machine-specific SOPs stay centralized and can be connected directly to operational problems.",
  },
  {
    id: 16,
    text: "When a machine requires outside expertise, the vendor can be connected to the issue and equipment context. Your team keeps the operational history together instead of starting the explanation over with every service call.",
  },
  {
    id: 17,
    text: "For manufacturers operating more than one facility, Relay brings plants, areas, equipment, and issues into one system. Leadership can see where problems are occurring without depending on separate plant-level reporting.",
  },
  {
    id: 18,
    text: "Complex problems often create several pieces of work. Relay lets managers assign responsibility clearly so maintenance, quality, production, and other teams know what needs to happen and who owns it.",
  },
  {
    id: 19,
    text: "Once Relay accumulates operating history, recurring breakdowns and problem patterns become easier to see. That gives management better information for maintenance planning, equipment decisions, and continuous improvement.",
  },
  {
    id: 20,
    text: "The people closest to production often see problems first. Employee Voice gives operators and technicians a structured channel for concerns, suggestions, near-misses, and improvement ideas across shifts and plants.",
  },
  {
    id: 21,
    text: "That's Relay for Manufacturing: equipment problems captured when they happen, clear maintenance accountability, machine history, procedures, assignments, and visibility across the operation. Relay gives the plant floor and management one system for keeping problems from falling between the cracks.",
  },
]

// ── Generator ──────────────────────────────────────────────────────────────────

function generate(prefix, step) {
  return new Promise((resolve, reject) => {
    const fileName = `${prefix}-step-${String(step.id).padStart(2, "0")}.mp3`
    const filePath = path.join(OUT_DIR, fileName)

    const body = JSON.stringify({
      text: step.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability:         0.15,
        similarity_boost:  0.85,
        style:             0.75,
        use_speaker_boost: true,
      },
    })

    const options = {
      hostname: "api.elevenlabs.io",
      path:     `/v1/text-to-speech/${VOICE_ID}`,
      method:   "POST",
      headers: {
        "xi-api-key":     API_KEY,
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        Accept:           "audio/mpeg",
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
  const groups = [
    { prefix: "carwash",       steps: CARWASH_STEPS },
    { prefix: "property",      steps: PROPERTY_STEPS },
    { prefix: "manufacturing",  steps: MANUFACTURING_STEPS },
  ]

  for (const { prefix, steps } of groups) {
    console.log(`\n── ${prefix} (${steps.length} steps) ─────────────────────────`)
    for (const step of steps) {
      try {
        await generate(prefix, step)
        await sleep(400)
      } catch (err) {
        console.error(`✗ ${prefix}-step-${String(step.id).padStart(2, "0")}.mp3:`, err.message)
        process.exitCode = 1
      }
    }
  }

  console.log("\nDone.")
}

main()
