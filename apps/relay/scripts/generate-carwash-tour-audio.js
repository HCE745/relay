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

const STEPS = [
  {
    id: 1,
    text: "Running a car wash means keeping equipment running, responding to customer problems, and staying ahead of maintenance. Relay puts all of that in one place so issues do not disappear into texts, calls, or memory.",
  },
  {
    id: 2,
    text: "Your Wash Overview shows what matters immediately — which bays are operating, what equipment is down, customer reports today, and open maintenance. You can see where attention is needed without digging through the system.",
  },
  {
    id: 3,
    text: "Customers often notice equipment problems first. Relay lets them scan a QR code on a bay, vacuum, or other equipment and report the problem in seconds — no login and no app required.",
  },
  {
    id: 4,
    text: "The QR code already identifies the wash, location, and equipment. The customer simply chooses what went wrong, adds details if needed, and submits the report directly to your operation.",
  },
  {
    id: 5,
    text: "The report appears inside Relay with the equipment, site, time, and problem already attached. Your team immediately knows what happened and where.",
  },
  {
    id: 6,
    text: "Assign the problem to the person responsible for handling it. Relay gives every issue a clear owner so managers can see what is being worked on and what still needs attention.",
  },
  {
    id: 7,
    text: "As the problem is handled, your team can update its status, add notes and photos, and document the resolution. Everyone sees the same record instead of chasing updates.",
  },
  {
    id: 8,
    text: "Each piece of equipment builds a history of its problems and repairs. That makes recurring failures easier to spot and gives you context before the next service visit.",
  },
  {
    id: 9,
    text: "Relay also helps you stay ahead of recurring maintenance instead of waiting for equipment to fail. Keep routine service visible and make sure required maintenance does not get forgotten.",
  },
  {
    id: 10,
    text: "For operators with several washes, Relay brings each location into one view. You can quickly see which sites have open issues and where equipment needs attention.",
  },
  {
    id: 11,
    text: "Over time, the history in Relay shows which equipment causes the most problems, where issues keep recurring, and how quickly they get resolved. That gives you better information for maintenance and replacement decisions.",
  },
  {
    id: 12,
    text: "Wash Essentials is designed for smaller car-wash operators that need a simple way to manage equipment problems, maintenance, and customer reports. Larger organizations can use the full Relay Wash Edition for advanced teams, workflows, routing, and operational coordination.",
  },
]

function generate(step) {
  return new Promise((resolve, reject) => {
    const fileName = `carwash-step-${String(step.id).padStart(2, "0")}.mp3`
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
  // Only delete existing carwash-step-*.mp3 files — leave generic step-N.mp3 files untouched
  const existing = fs.readdirSync(OUT_DIR).filter(f => f.startsWith("carwash-step-") && f.endsWith(".mp3"))
  for (const f of existing) {
    fs.unlinkSync(path.join(OUT_DIR, f))
    console.log(`✗ deleted ${f}`)
  }
  if (existing.length) console.log()

  console.log(`Generating ${STEPS.length} Car Wash audio clips → ${OUT_DIR}\n`)
  for (const step of STEPS) {
    try {
      await generate(step)
    } catch (err) {
      console.error(`✗ carwash-step-${String(step.id).padStart(2, "0")}.mp3:`, err.message)
    }
  }
  console.log("\nDone.")
}

main()
