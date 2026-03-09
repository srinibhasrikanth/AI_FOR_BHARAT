/**
 * voice_pipeline.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps Sarvam AI speech-to-text with speaker diarization.
 *
 * Automatically splits audio longer than Sarvam's 30-second real-time API
 * limit into ≤25 s WAV segments using fluent-ffmpeg, transcribes each in
 * sequence, then merges results with a consistent speaker map.
 *
 * Returns:
 * {
 *   full_text : string,
 *   language  : string,
 *   speakers  : [{ speaker: "Doctor"|"Patient", text: string }]
 * }
 */

'use strict';

const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { SarvamAIClient } = require('sarvamai');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const API_KEY    = process.env.SARVAM_API_KEY;
const CHUNK_SECS = 25; // safely under Sarvam's 30 s hard limit

// ─── ffmpeg helpers ────────────────────────────────────────────────────────────

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      resolve(parseFloat(meta?.format?.duration) || 0);
    });
  });
}

/** Convert to 16 kHz mono WAV (single output). */
function convertToWav(inputPath, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-ar', '16000', '-ac', '1', '-c', 'pcm_s16le'])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

/** Split into ≤chunkSecs WAV segments named chunk_0.wav, chunk_1.wav … */
function splitAudio(inputPath, outDir, chunkSecs = CHUNK_SECS) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', String(chunkSecs),
        '-c', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-reset_timestamps', '1',
      ])
      .output(path.join(outDir, 'chunk_%d.wav'))
      .on('end', () => {
        const files = fs.readdirSync(outDir)
          .filter((f) => /^chunk_\d+\.wav$/.test(f))
          .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
          .map((f) => path.join(outDir, f));
        resolve(files);
      })
      .on('error', reject)
      .run();
  });
}

// ─── Speaker helpers ───────────────────────────────────────────────────────────

function buildSpeakerMap(entries = []) {
  const seen = [];
  for (const e of entries) {
    if (e.speaker_id && !seen.includes(e.speaker_id)) seen.push(e.speaker_id);
    if (seen.length >= 2) break;
  }
  const roles = ['Doctor', 'Patient'];
  const map = {};
  seen.forEach((id, idx) => { map[id] = roles[idx] ?? `Speaker_${idx + 1}`; });
  return map;
}

function groupEntries(entries, speakerMap) {
  const result = [];
  let cur = null;
  for (const entry of entries) {
    const role = speakerMap[entry.speaker_id] ?? entry.speaker_id ?? 'Unknown';
    const text = (entry.transcript || '').trim();
    if (!text) continue;
    if (cur && cur.speaker === role) {
      cur.text += ' ' + text;
    } else {
      if (cur) result.push(cur);
      cur = { speaker: role, text };
    }
  }
  if (cur) result.push(cur);
  return result;
}

// ─── Single-chunk transcription ────────────────────────────────────────────────

async function transcribeChunk(chunkPath, languageCode, speakerMap) {
  const client = new SarvamAIClient({ apiSubscriptionKey: API_KEY });

  const params = {
    file: fs.createReadStream(chunkPath),
    model: 'saaras:v3',
    mode: 'transcribe',
    language_code: languageCode,
    with_diarization: true,
    num_speakers: 2,
  };

  let response;
  try {
    response = await client.speechToText.transcribe(params);
  } catch (err) {
    console.warn('[voice_pipeline] Diarization failed on chunk, retrying without:', err.message);
    delete params.with_diarization;
    delete params.num_speakers;
    response = await client.speechToText.transcribe(params);
  }

  const fullText = (response.transcript || '').trim();
  const language = response.language_code || languageCode;

  const diarized = response.diarized_transcript;
  let activeSpeakerMap = speakerMap;
  let speakers = [];

  if (diarized && Array.isArray(diarized.entries) && diarized.entries.length > 0) {
    if (!activeSpeakerMap) activeSpeakerMap = buildSpeakerMap(diarized.entries);
    speakers = groupEntries(diarized.entries, activeSpeakerMap);
  } else if (fullText) {
    if (!activeSpeakerMap) activeSpeakerMap = {};
    speakers = [{ speaker: 'Doctor', text: fullText }];
  }

  return { fullText, language, speakers, speakerMap: activeSpeakerMap };
}

// ─── Temp directory helpers ────────────────────────────────────────────────────

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `vp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Transcribes an audio file with speaker diarization.
 * Files longer than CHUNK_SECS seconds are automatically split before sending.
 *
 * @param {string} filePath
 * @param {object} [options]
 * @param {string} [options.language_code="en-IN"]
 * @returns {Promise<{ full_text: string, language: string, speakers: Array<{speaker:string,text:string}> }>}
 */
async function transcribeWithDiarization(filePath, options = {}) {
  if (!API_KEY) throw new Error('SARVAM_API_KEY is not set in environment.');

  const languageCode = options.language_code || 'en-IN';
  const tmpDir = makeTempDir();

  try {
    // ── Probe duration ───────────────────────────────────────────────────────
    let duration = 0;
    try {
      duration = await probeDuration(filePath);
    } catch (err) {
      console.warn('[voice_pipeline] ffprobe failed, assuming long audio:', err.message);
      duration = Infinity;
    }

    // ── Short audio: convert to WAV + single transcribe ──────────────────────
    if (duration <= CHUNK_SECS) {
      const wavPath = path.join(tmpDir, 'audio.wav');
      await convertToWav(filePath, wavPath);
      const { fullText, language, speakers } = await transcribeChunk(wavPath, languageCode, null);
      return { full_text: fullText, language, speakers };
    }

    // ── Long audio: split → transcribe chunks → merge ─────────────────────────
    console.log(`[voice_pipeline] ${Number(duration).toFixed(1)}s audio — splitting into ${CHUNK_SECS}s chunks`);
    const chunkPaths = await splitAudio(filePath, tmpDir);
    console.log(`[voice_pipeline] ${chunkPaths.length} chunk(s) created`);

    let speakerMap    = null;
    let mergedText    = '';
    let mergedSpeakers = [];
    let detectedLang  = languageCode;

    for (const chunkPath of chunkPaths) {
      const result = await transcribeChunk(chunkPath, languageCode, speakerMap);

      // Lock in speaker map from first chunk that yields diarization
      if (!speakerMap && result.speakerMap && Object.keys(result.speakerMap).length > 0) {
        speakerMap = result.speakerMap;
      }

      if (result.fullText) {
        mergedText += (mergedText ? ' ' : '') + result.fullText;
        // Merge speaker segments: extend last entry if same speaker continues
        for (const seg of result.speakers) {
          const last = mergedSpeakers[mergedSpeakers.length - 1];
          if (last && last.speaker === seg.speaker) {
            last.text += ' ' + seg.text;
          } else {
            mergedSpeakers.push({ ...seg });
          }
        }
      }
      detectedLang = result.language || detectedLang;
    }

    return {
      full_text: mergedText,
      language:  detectedLang,
      speakers:  mergedSpeakers.length > 0
        ? mergedSpeakers
        : mergedText ? [{ speaker: 'Doctor', text: mergedText }] : [],
    };

  } finally {
    cleanupDir(tmpDir);
  }
}

module.exports = { transcribeWithDiarization };
