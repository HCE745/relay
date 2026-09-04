#!/usr/bin/env node
// Regenerates steps 15-17 (Assignments, My Work, Announcements) in their new positions,
// and renames old step-15/16/17 (Roles, Industry, Packages) → step-18/19/20.
// Steps 01-14 and step-21 are not touched.

const fs = require("fs")
const path = require("path")
const https = require("https")

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID
const API_KEY  = process.env.ELEVENLABS_API_KEY

if (!API_KEY)  { console.error("Missing ELEVENLABS_API_KEY"); process.exit(1) }
if (!VOICE_ID) { console.error("Missing ELEVENLABS_VOICE_ID"); process.exit(1) }

const OUT_DIR = path.join(__dirname, "..", "public", "demo-audio")
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// New content for steps 15, 16, 17
const NEW_STEPS = [
  {
    id: 15,
    text: "When an issue is reported, managers can create specific assignments for each person involved — shut down the equipment, contact the vendor, order the part. Every piece of work has a clear owner and a due date. Nothing gets lost, nothing gets forgotten, and every assignment links directly back to the issue that triggered it.",
  },
  {
    id: 16,
    text: "When an employee opens Relay, they see one thing: their work. No hunting around the system. No missing assignments. Just a clear answer to what needs to get done today, what is overdue, and what is urgent.",
  },
  {
    id: 17,
    text: "Managers can broadcast operational announcements to the entire company, a specific location, or a single department. For emergencies, Relay tracks acknowledgment in real time so you always know who has received critical information.",
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
  // Step 1: Backup old step-15/16/17 (Roles, Industry, Packages) to temp names
  // so we can move them to step-18/19/20 after generating the new files.
  const backups = [
    { from: "step-15.mp3", to: "step-15_backup.mp3" },
    { from: "step-16.mp3", to: "step-16_backup.mp3" },
    { from: "step-17.mp3", to: "step-17_backup.mp3" },
  ]
  for (const { from, to } of backups) {
    const src = path.join(OUT_DIR, from)
    const dst = path.join(OUT_DIR, to)
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst)
      console.log(`  renamed ${from} → ${to}`)
    }
  }

  // Step 2: Delete old step-18/19/20 (Assignments, My Work, Announcements at old positions)
  for (const id of [18, 19, 20]) {
    const f = path.join(OUT_DIR, `step-${String(id).padStart(2, "0")}.mp3`)
    if (fs.existsSync(f)) {
      fs.unlinkSync(f)
      console.log(`  deleted step-${String(id).padStart(2, "0")}.mp3`)
    }
  }

  console.log()
  console.log(`Generating ${NEW_STEPS.length} audio clips for steps 15-17 → ${OUT_DIR}\n`)

  // Step 3: Generate new step-15, 16, 17
  for (const step of NEW_STEPS) {
    try {
      await generate(step)
    } catch (err) {
      console.error(`✗ step-${String(step.id).padStart(2, "0")}.mp3:`, err.message)
    }
  }

  // Step 4: Move backups → step-18/19/20
  console.log()
  const moves = [
    { from: "step-15_backup.mp3", to: "step-18.mp3" },
    { from: "step-16_backup.mp3", to: "step-19.mp3" },
    { from: "step-17_backup.mp3", to: "step-20.mp3" },
  ]
  for (const { from, to } of moves) {
    const src = path.join(OUT_DIR, from)
    const dst = path.join(OUT_DIR, to)
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst)
      console.log(`  renamed ${from} → ${to}`)
    }
  }

  console.log("\nDone.")
}

main()
