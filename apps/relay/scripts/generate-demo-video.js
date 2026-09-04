#!/usr/bin/env node
'use strict';

/**
 * Relay Demo Video Generator — v3
 *
 * New architecture: the /demo-video route handles all scene navigation,
 * highlight effects, and timing internally. Playwright just records what
 * the browser renders — no element interaction needed.
 *
 * Flow:
 *   1. Generate voiceover audio with ElevenLabs (or OpenAI fallback)
 *   2. Copy audio to /public/demo-video-audio/ (used by ?audio=true mode)
 *   3. Create demo session in Playwright
 *   4. Navigate to /demo-video?audio=true and record the full playthrough
 *   5. Build a concatenated audio track (audio clips + inter-scene gaps)
 *   6. Merge video + audio with ffmpeg
 *
 * Usage:
 *   node scripts/generate-demo-video.js             # full run
 *   node scripts/generate-demo-video.js --debug     # audio only + screenshot
 *   node scripts/generate-demo-video.js --audio-only # generate audio, skip record
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = 'https://app.getrelay.software';
const W        = 1280;
const H        = 720;

// Estimated ms overhead per scene transition (fade + iframe nav + fade)
const TRANSITION_OVERHEAD_MS = 2000;
// Auto-start delay before scene 1 begins
const AUTOSTART_MS = 2000;

const RELAY_ROOT   = path.join(__dirname, '..');
const OUTPUT_DIR   = path.join(RELAY_ROOT, 'demo-video-output');
const AUDIO_DIR    = path.join(OUTPUT_DIR, 'audio');
const SCREENSHOTS  = path.join(OUTPUT_DIR, 'screenshots');
const FINAL_MP4    = path.join(OUTPUT_DIR, 'relay-demo-v1.mp4');
const SCRIPT_JSON  = path.join(__dirname, 'demo-video-script.json');
// Audio served by the page in ?audio=true mode
const PUBLIC_AUDIO = path.join(RELAY_ROOT, 'public', 'demo-video-audio');

// ─── Env ─────────────────────────────────────────────────────────────────────

for (const f of ['.env.local', '.env']) {
  const p = path.join(RELAY_ROOT, f);
  if (fs.existsSync(p)) require('dotenv').config({ path: p });
}

const ELEVENLABS_KEY   = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
const OPENAI_KEY       = process.env.OPENAI_API_KEY;
const DEBUG_MODE       = process.argv.includes('--debug');
const AUDIO_ONLY       = process.argv.includes('--audio-only');
const FRESH_AUDIO      = process.argv.includes('--fresh-audio'); // delete cached audio and regenerate

// ─── Logging ─────────────────────────────────────────────────────────────────

const log  = (m) => console.log(`[demo] ${m}`);
const warn = (m) => console.warn(`[demo] ⚠  ${m}`);
const ok   = (m) => console.log(`[demo] ✓  ${m}`);
const fail = (m) => console.error(`[demo] ✗  ${m}`);

// ─── FS ──────────────────────────────────────────────────────────────────────

function mkdirs() {
  [OUTPUT_DIR, AUDIO_DIR, SCREENSHOTS, PUBLIC_AUDIO]
    .forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function ffprobe(file) {
  try {
    const raw = execSync(
      `ffprobe -v quiet -print_format json -show_streams -show_format "${file}"`,
      { encoding: 'utf8' });
    const d   = JSON.parse(raw);
    const dur = parseFloat(
      d.streams?.find(s => s.codec_type === 'audio')?.duration ??
      d.streams?.find(s => s.codec_type === 'video')?.duration ??
      d.format?.duration ?? '0');
    return { duration: dur };
  } catch { return { duration: 0 }; }
}

function ffrun(args, label) {
  log(`  ffmpeg: ${label}`);
  try {
    execSync(`ffmpeg -y ${args}`, { stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`ffmpeg "${label}": ${e.stderr?.toString().slice(-400) ?? e.message}`);
  }
}

// ─── Audio generation ─────────────────────────────────────────────────────────

async function ttsElevenLabs(text, out) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`,
    {
      method:  'POST',
      headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.15, similarity_boost: 0.85, style: 0.75, use_speaker_boost: true },
      }),
    });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

async function ttsOpenAI(text, out) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method:  'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', input: text, voice: 'onyx', speed: 0.9 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

function silentMp3(sec, out) {
  ffrun(
    `-f lavfi -i anullsrc=r=44100:cl=stereo -t ${sec} -c:a libmp3lame -b:a 64k "${out}"`,
    `silent ${sec}s`);
}

async function getAudio(idx, narration, durationSec) {
  const p = path.join(AUDIO_DIR, `step-${String(idx).padStart(2, '0')}.mp3`);
  if (FRESH_AUDIO && fs.existsSync(p)) { fs.unlinkSync(p); log(`  cleared cached step-${idx}`); }
  if (fs.existsSync(p)) { log(`  audio cached step-${idx}`); return p; }
  log(`  generating audio step ${idx}…`);
  if (ELEVENLABS_KEY && !ELEVENLABS_KEY.startsWith('your-') && !ELEVENLABS_KEY.startsWith('sk_xx')) {
    try { await ttsElevenLabs(narration, p); ok(`  ElevenLabs step ${idx}`); return p; } catch (e) { warn(`EL step ${idx}: ${e.message}`); }
  }
  if (OPENAI_KEY && !OPENAI_KEY.startsWith('sk-xx')) {
    try { await ttsOpenAI(narration, p); ok(`  OpenAI step ${idx}`); return p; } catch (e) { warn(`OAI step ${idx}: ${e.message}`); }
  }
  warn(`No TTS for step ${idx} — using ${durationSec}s silence`);
  silentMp3(durationSec, p);
  return p;
}

// ─── Demo session ─────────────────────────────────────────────────────────────

async function createDemoSession(browser) {
  log('Creating demo session via /api/demo/start…');
  const ctx  = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  const res = await page.evaluate(async (url) => {
    const r = await fetch(`${url}/api/demo/start`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ superAdminBypass: true, industry: 'Manufacturing' }),
    });
    return { status: r.status };
  }, BASE_URL);

  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`/api/demo/start returned ${res.status}`);
  }
  ok('Demo session created');

  const cookies = await ctx.cookies();
  await ctx.close();

  if (!cookies.some(c => c.name === 'session')) {
    throw new Error('No session cookie after /api/demo/start');
  }
  ok(`${cookies.length} cookies captured (session ✓)`);
  return cookies;
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function screenshot(page, name) {
  const p = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: p }).catch(e => warn(`screenshot ${name}: ${e.message}`));
  log(`  screenshot → ${name}.png`);
}

// ─── Full-page recording ──────────────────────────────────────────────────────

// Total video duration in ms. The /demo-video page handles all timing internally.
// 1s loading + 8s intro + 0.4s + scenes 2-11 + 0.4s each + 12s outro ≈ 185s
const RECORD_MS   = 185000;
const RECORD_BUFFER_MS = 12000;

async function recordFullVideo(browser, cookies) {
  const videoDir = path.join(OUTPUT_DIR, 'raw');
  fs.mkdirSync(videoDir, { recursive: true });

  const totalSec = ((RECORD_MS + RECORD_BUFFER_MS) / 1000).toFixed(0);
  log(`Recording /demo-video for ${totalSec}s (page controls all timing)…`);
  log(`  → URL: ${BASE_URL}/demo-video`);

  const ctx = await browser.newContext({
    viewport:    { width: W, height: H },
    recordVideo: { dir: videoDir, size: { width: W, height: H } },
    userAgent:   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  });

  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  await page.goto(`${BASE_URL}/demo-video`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // The page plays all scenes itself — just wait for it to finish
  await page.waitForTimeout(RECORD_MS + RECORD_BUFFER_MS);

  await screenshot(page, 'recording-final-frame');

  const video = page.video();
  await ctx.close();
  const videoPath = await video.path();
  ok(`Raw video: ${videoPath}`);
  return videoPath;
}

// ─── Audio track construction ─────────────────────────────────────────────────

/**
 * Build a single audio track that interleaves silence gaps with narration.
 * Layout matches the /demo-video page's timing in ?audio=true mode:
 *   AUTOSTART_MS silence → scene1 audio → TRANSITION_OVERHEAD_MS silence → scene2 audio → ...
 */
function buildAudioTrack(audioPaths, outputPath) {
  log('Building concatenated audio track…');

  // Build ordered list of segments: [silence, audio, silence, audio, ...]
  const segments = [];

  // Initial auto-start silence
  const initSilence = path.join(OUTPUT_DIR, 'audio', '_silence-init.mp3');
  silentMp3(AUTOSTART_MS / 1000, initSilence);
  segments.push(initSilence);

  for (let i = 0; i < audioPaths.length; i++) {
    segments.push(audioPaths[i]);
    if (i < audioPaths.length - 1) {
      const gapPath = path.join(OUTPUT_DIR, 'audio', `_silence-gap-${i}.mp3`);
      silentMp3(TRANSITION_OVERHEAD_MS / 1000, gapPath);
      segments.push(gapPath);
    }
  }

  // Concat via concat demuxer
  const listFile = path.join(OUTPUT_DIR, 'audio', '_concat-list.txt');
  const listContent = segments.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  ffrun(
    `-f concat -safe 0 -i "${listFile}" -c:a libmp3lame -b:a 128k "${outputPath}"`,
    'concat audio track'
  );

  ok(`Audio track: ${path.basename(outputPath)}`);
  return outputPath;
}

// ─── Final combine ────────────────────────────────────────────────────────────

function combineVideoAudio(videoPath, audioPath, outputPath) {
  log('Combining video + audio…');
  const videoDur = ffprobe(videoPath).duration;
  const audioDur = ffprobe(audioPath).duration;
  log(`  video: ${videoDur.toFixed(1)}s, audio: ${audioDur.toFixed(1)}s`);

  const needsPad = audioDur > videoDur + 0.5;
  const pad = needsPad ? (audioDur - videoDur + 0.5).toFixed(3) : '0';
  const padFilter = needsPad ? `tpad=stop_mode=clone:stop_duration=${pad},` : '';
  const target = (audioDur + 0.5).toFixed(3);

  ffrun(
    `-i "${videoPath}" -i "${audioPath}" ` +
    `-vf "${padFilter}scale=${W}:${H}:flags=lanczos,fps=30" ` +
    `-c:v libx264 -crf 18 -preset medium ` +
    `-c:a aac -b:a 128k ` +
    `-t ${target} ` +
    `-movflags +faststart "${outputPath}"`,
    `video+audio final${needsPad ? ` (pad +${pad}s)` : ''}`
  );
}

// ─── Debug mode ───────────────────────────────────────────────────────────────

async function runDebugMode(browser, cookies) {
  log('DEBUG MODE — creating session + opening /demo-video for inspection');

  const ctx  = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  await page.goto(`${BASE_URL}/demo-video?audio=false`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Wait for auto-start + first two scenes to render
  await page.waitForTimeout(6000);
  await screenshot(page, 'debug-01-demo-video-loading');
  await page.waitForTimeout(8000);
  await screenshot(page, 'debug-02-demo-video-scene1');
  await page.waitForTimeout(5000);
  await screenshot(page, 'debug-03-demo-video-scene2');

  await ctx.close();

  console.log('\n══════════════════════════════════════');
  console.log('  Debug screenshots saved to:');
  console.log(`  ${SCREENSHOTS}/`);
  console.log('══════════════════════════════════════\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(DEBUG_MODE
    ? '║   Relay Demo Video — DEBUG MODE      ║'
    : AUDIO_ONLY
    ? '║   Relay Demo Video — AUDIO ONLY      ║'
    : '║   Relay Demo Video Generator v3      ║');
  console.log('╚══════════════════════════════════════╝\n');

  mkdirs();

  const script = JSON.parse(fs.readFileSync(SCRIPT_JSON, 'utf8'));

  // Phase 1 — generate audio
  console.log('\n── Phase 1: audio generation ──');
  const audioPaths = [];
  for (let i = 0; i < script.steps.length; i++) {
    const step = script.steps[i];
    audioPaths.push(await getAudio(i + 1, step.narration, step.durationSeconds));
  }
  const audioDurs = audioPaths.map(p => ffprobe(p).duration);

  // Phase 2 — copy audio to public dir
  console.log('\n── Phase 2: publishing audio ──');
  for (let i = 0; i < audioPaths.length; i++) {
    const dest = path.join(PUBLIC_AUDIO, `step-${String(i + 1).padStart(2, '0')}.mp3`);
    fs.copyFileSync(audioPaths[i], dest);
    log(`  copied step-${String(i + 1).padStart(2, '0')}.mp3 → public/demo-video-audio/`);
  }
  ok('All audio clips published');

  if (AUDIO_ONLY) {
    console.log('\n  --audio-only: skipping recording.\n');
    return;
  }

  // Audio track duration info
  const totalAudioMs = audioDurs.reduce((s, d) => s + d * 1000, 0);
  log(`\n  Recording duration: ${(RECORD_MS / 1000).toFixed(0)}s + ${(RECORD_BUFFER_MS / 1000).toFixed(0)}s buffer`);
  log(`  Audio track: ${(totalAudioMs / 1000).toFixed(0)}s narration + gaps`);

  // Phase 3 — create browser session
  console.log('\n── Phase 3: browser session ──');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'],
  });

  let cookies;
  try {
    cookies = await createDemoSession(browser);
  } catch (err) {
    fail(`Session setup: ${err.message}`);
    await browser.close();
    process.exit(1);
  }

  if (DEBUG_MODE) {
    await runDebugMode(browser, cookies);
    await browser.close();
    return;
  }

  // Phase 4 — record
  console.log('\n── Phase 4: recording ──');
  let rawVideoPath;
  try {
    rawVideoPath = await recordFullVideo(browser, cookies);
  } catch (err) {
    fail(`Recording: ${err.message}`);
    await browser.close();
    process.exit(1);
  }
  await browser.close();

  // Phase 5 — audio track
  console.log('\n── Phase 5: audio track ──');
  const audioTrackPath = path.join(OUTPUT_DIR, 'audio-track.mp3');
  buildAudioTrack(audioPaths, audioTrackPath);

  // Phase 6 — combine
  console.log('\n── Phase 6: final output ──');
  combineVideoAudio(rawVideoPath, audioTrackPath, FINAL_MP4);

  const { duration } = ffprobe(FINAL_MP4);
  const mb = (fs.statSync(FINAL_MP4).size / 1024 / 1024).toFixed(1);

  console.log('\n══════════════════════════════════════════');
  console.log(`  Final video: ${duration.toFixed(0)}s · ${mb} MB`);
  console.log(`  ${FINAL_MP4}`);
  console.log(`  Screenshots: ${SCREENSHOTS}/`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(err => {
  fail(`Fatal: ${err.message}`);
  process.exit(1);
});
