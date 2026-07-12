#!/usr/bin/env node
// Generates only the new/changed tour audio steps: 18, 19, 20, 21
// Leaves steps 01-17 untouched.

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
    id: 18,
    text: "When an issue is reported, managers can create specific assignments for each person involved — shut down the equipment, contact the vendor, order the part. Every piece of work has a clear owner and a due date. Nothing gets lost, nothing gets forgotten, and every assignment links directly back to the issue that triggered it.",
  },
  {
    id: 19,
    text: "When an employee opens Relay, they see one thing: their work. No hunting around the system. No missing assignments. Just a clear answer to what needs to get done today, what is overdue, and what is urgent.",
  },
  {
    id: 20,
    text: "Managers can broadcast operational announcements to the entire company, a specific location, or a single department. For emergencies, Relay tracks acknowledgment in real time so you always know who has received critical information.",
  },
  {
    id: 21,
    text: "You have just seen the core of what Relay can do. From the moment a problem is reported... to the assignment that resolves it... the announcement that keeps everyone informed... and the analytics that prevent it from happening again. Every issue has an owner. Every action is tracked. Every organization becomes smarter over time. Continue exploring the demo, start your free trial, or schedule a personalized demonstration. Thanks for taking the tour.",
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
  // Delete only the files we're replacing
  for (const step of STEPS) {
    const fileName = `step-${String(step.id).padStart(2, "0")}.mp3`
    const filePath = path.join(OUT_DIR, fileName)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`✗ deleted ${fileName}`)
    }
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
