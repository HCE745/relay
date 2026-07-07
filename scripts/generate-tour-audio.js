#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const https = require("https")

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID
const API_KEY  = process.env.ELEVENLABS_API_KEY

if (!API_KEY)  { console.error("Missing ELEVENLABS_API_KEY"); process.exit(1) }
if (!VOICE_ID) { console.error("Missing ELEVENLABS_VOICE_ID"); process.exit(1) }

const OUT_DIR = path.join(__dirname, "..", "public", "demo-audio")
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const STEPS = [
  {
    id: 1,
    text: "Welcome to Relay. Over the next few minutes, we will walk through how Relay helps organizations ensure operational issues never fall through the cracks. We will follow a single issue from the moment it is reported... through assignment, resolution, analysis, and long-term operational improvement. You can pause, skip, or exit the tour at any time.",
  },
  {
    id: 2,
    text: "This is Relay's operational dashboard. It gives managers an immediate view of what is happening across their organization — open issues, escalations, recent activity, and operational performance. Instead of chasing updates... everything is visible in one place.",
  },
  {
    id: 3,
    text: "Every issue starts here. Employees can report problems in seconds from any computer, tablet, or mobile device. Relay captures everything needed to begin resolution — the location, priority, department, and description.",
  },
  {
    id: 4,
    text: "As soon as an issue is submitted... Relay automatically routes it to the appropriate person based on your organization's routing rules. No manager needs to manually sort incoming requests.",
  },
  {
    id: 5,
    text: "Every issue has a complete history. You can always see who reported it, who owns it, what changed, and every action taken from start to finish.",
  },
  {
    id: 6,
    text: "Relay's AI analyzes the issue and suggests likely causes, recommended actions, and possible resolutions. AI helps your team respond faster... while keeping people in control of every decision.",
  },
  {
    id: 7,
    text: "Relay can also identify when an issue may be related to a standard operating procedure. This helps organizations improve processes... instead of simply fixing the same problems repeatedly.",
  },
  {
    id: 8,
    text: "Every asset has its own operational history. Instead of viewing problems in isolation... your team can understand the complete maintenance history of every piece of equipment.",
  },
  {
    id: 9,
    text: "Every issue contributes to better operational insight. Relay identifies recurring failures, response times, bottlenecks, and trends that would otherwise remain hidden.",
  },
  {
    id: 10,
    text: "Relay can anonymously compare your operation against similar organizations. This helps identify opportunities for improvement... based on real operational data.",
  },
  {
    id: 11,
    text: "Anyone can report an issue by scanning a Relay QR code. No account or app is required. Reports are automatically linked to the correct location or asset.",
  },
  {
    id: 12,
    text: "Relay keeps vendors connected to the issues and assets they support. Contacts, service history, and communications stay organized in one place.",
  },
  {
    id: 13,
    text: "Routine replacement requests do not always require manual approval. Relay can identify common items, verify damage, apply purchasing policies, and automatically approve routine replacements... while escalating larger purchases.",
  },
  {
    id: 14,
    text: "As organizations grow, Relay grows with them. Executive dashboards provide leadership with operational health scores, AI-generated summaries, and organization-wide performance metrics.",
  },
  {
    id: 15,
    text: "Every user sees the information they need. Employees report issues. Supervisors manage work. Managers monitor performance. Administrators configure the platform.",
  },
  {
    id: 16,
    text: "Relay adapts to different industries automatically. Departments, assets, issue categories, and workflows change to match the way your organization operates.",
  },
  {
    id: 17,
    text: "Whether you are managing a single location or hundreds of facilities, Relay scales alongside your organization. Choose the package that matches your operational needs today and expand as you grow.",
  },
  {
    id: 18,
    text: "You have just seen the core of what Relay can do. Every issue has an owner. Every action is tracked. Every organization becomes smarter over time. Continue exploring the demo, start your free trial, or schedule a personalized demonstration. Thanks for taking the tour.",
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
        stability: 0.15,
        similarity_boost: 0.85,
        style: 0.75,
        use_speaker_boost: true,
      },
    })

    const options = {
      hostname: "api.elevenlabs.io",
      path: `/v1/text-to-speech/${VOICE_ID}`,
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Accept: "audio/mpeg",
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
  // Delete existing cached files first
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
