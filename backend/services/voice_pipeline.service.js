/**
 * voice_pipeline.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates the full Real-Time Voice → Clinical Note pipeline:
 *
 *   1. Writes the uploaded audio buffer to a temp file.
 *   2. Calls voice_pipeline.js → Sarvam AI STT + speaker diarization.
 *   3. Runs a LangGraph StateGraph (Gemini-powered) with 4 parallel nodes:
 *        soapNode       → { subjective, objective, assessment, plan }
 *        vitalsNode     → { bp, hr, temperature, spO2, weight, height, sugar, pr }
 *        icdNode        → [ { code, description } ]
 *        prescriptionNode → [ { name, dosage, timing, durationDays, instructions } ]
 *   4. Saves a Transcript document linked to the session.
 *   5. Updates Session.draftData with the AI result (doctor reviews before
 *      finalising via the existing /consultation/finalize endpoint).
 *
 * Output shape returned to the route:
 * {
 *   transcript : { full_text, language, speakers },
 *   soap       : { subjective, objective, assessment, plan },
 *   vitals     : { bp, hr, temperature, spO2, weight, height, sugar, pr },
 *   icd_codes  : [{ code, description }],
 *   prescription: [{ name, dosage, timing, durationDays, instructions }],
 *   transcriptDoc : <saved Transcript _id>,
 *   sessionId     : string
 * }
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { SarvamAIClient } = require('sarvamai');

const { transcribeWithDiarization } = require('../ai_services/voice_pipeline');
const Transcript = require('../models/Transcript.model');
const Session    = require('../models/Session.model');

// ─── Sarvam LLM helper ────────────────────────────────────────────────────────────────
function getSarvamClient() {
  if (!process.env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not set.');
  return new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
}

async function callSarvamLLM(prompt) {
  const client = getSarvamClient();
  const response = await client.chat.completions({
    messages: [{ role: 'user', content: prompt }],
    model: 'sarvam-m',
  });
  return response.choices[0].message.content || '';
}

function stripFences(text = '') {
  return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

/**
 * Tries to extract the first valid JSON object `{...}` or array `[...]`
 * from a raw LLM response, regardless of wrapping text or markdown fences.
 */
function extractJson(text = '', expectArray = false) {
  // 1. Strip common markdown fences first
  const stripped = stripFences(text);

  // 2. Try to parse the stripped text directly
  try { return JSON.parse(stripped); } catch (_) { /* fall through */ }

  // 3. Locate the outermost JSON structure in the raw text
  const open  = expectArray ? '[' : '{';
  const close = expectArray ? ']' : '}';
  const start = text.indexOf(open);
  const end   = text.lastIndexOf(close);
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) { /* fall through */ }
  }

  // 4. Try the other shape as a fallback (model sometimes wraps array in object)
  const altOpen  = expectArray ? '{' : '[';
  const altClose = expectArray ? '}' : ']';
  const altStart = text.indexOf(altOpen);
  const altEnd   = text.lastIndexOf(altClose);
  if (altStart !== -1 && altEnd !== -1 && altEnd > altStart) {
    try { return JSON.parse(text.slice(altStart, altEnd + 1)); } catch (_) { /* fall through */ }
  }

  return null; // could not extract
}

// ─── LangGraph state shape + graph definition ─────────────────────────────────

/**
 * We use @langchain/langgraph's StateGraph with a plain Annotation schema.
 * Each property uses the default "last-write-wins" reducer since nodes write
 * independent keys. The graph fans out from START in parallel and then merges.
 *
 * Graph topology:
 *
 *   START ──┬──► soapNode       ──┐
 *           ├──► vitalsNode     ──┤
 *           ├──► icdNode        ──┤  (all run in parallel)
 *           └──► prescriptionNode ┘
 *                     └──► END
 */
async function buildClinicalGraph() {
  // Dynamic require works because @langchain/langgraph ships a CJS build.
  const { StateGraph, END, START, Annotation } = require('@langchain/langgraph');

  const ClinicalState = Annotation.Root({
    transcriptText: Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
    soap:           Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
    vitals:         Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
    icd_codes:      Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
    prescription:   Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  });

  // ── Node: SOAP generation ──────────────────────────────────────────────────
  async function soapNode(state) {
    const raw = await callSarvamLLM(`You are an expert clinical assistant. Analyse this doctor-patient conversation transcript and generate a structured SOAP note.

Transcript:
"""
${state.transcriptText}
"""

Return ONLY valid JSON (no markdown fences) with this exact schema:
{
  "subjective": "Patient's chief complaint, history of present illness, symptoms as reported",
  "objective": "Measurable observations, physical exam findings, vital signs mentioned",
  "assessment": "Diagnosis or differential diagnoses with clinical reasoning",
  "plan": "Treatment plan, prescriptions, follow-up, referrals, lifestyle advice"
}`);
    try {
      const parsed = extractJson(raw, false);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          soap: {
            subjective: parsed.subjective || '',
            objective:  parsed.objective  || '',
            assessment: parsed.assessment || '',
            plan:       parsed.plan       || '',
          },
        };
      }
      throw new Error('invalid shape');
    } catch {
      // Last resort: put only the raw text in subjective so other fields stay empty
      return { soap: { subjective: String(raw).trim(), objective: '', assessment: '', plan: '' } };
    }
  }

  // ── Node: Vitals extraction ────────────────────────────────────────────────
  async function vitalsNode(state) {
    const raw = await callSarvamLLM(`Extract any vital signs explicitly mentioned in this clinical transcript.

Transcript:
"""
${state.transcriptText}
"""

Return ONLY valid JSON (no markdown fences). Use null for values not mentioned. All numbers must be numeric (no units in value).
{
  "bp":          "string e.g. '120/80' or null",
  "hr":          "number (bpm) or null",
  "temperature": "number (°C or °F, whichever mentioned) or null",
  "spO2":        "number (%) or null",
  "weight":      "number (kg) or null",
  "height":      "number (cm) or null",
  "sugar":       "number (mg/dL) or null",
  "pr":          "number (bpm) or null"
}`);
    try {
      const parsed = extractJson(raw, false);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { vitals: parsed };
      }
      throw new Error('invalid shape');
    } catch {
      return { vitals: { bp: null, hr: null, temperature: null, spO2: null, weight: null, height: null, sugar: null, pr: null } };
    }
  }

  // ── Node: ICD-10 codes ────────────────────────────────────────────────────
  async function icdNode(state) {
    const raw = await callSarvamLLM(`Based on this clinical transcript, suggest the most relevant ICD-10 codes.

Transcript:
"""
${state.transcriptText}
"""

Return ONLY a valid JSON array (no markdown fences, no extra text). Each item must have:
[
  { "code": "ICD-10 code e.g. J06.9", "description": "Plain-English description" }
]
Suggest 1-5 codes. Only include codes with high confidence.`);
    try {
      const parsed = extractJson(raw, true);
      return { icd_codes: Array.isArray(parsed) ? parsed : [] };
    } catch {
      return { icd_codes: [] };
    }
  }

  // ── Node: Prescription suggestions ───────────────────────────────────────
  async function prescriptionNode(state) {
    const raw = await callSarvamLLM(`Based on this clinical transcript, generate structured prescription suggestions.

Transcript:
"""
${state.transcriptText}
"""

Return ONLY a valid JSON array (no markdown fences). Each item:
[
  {
    "name":        "Generic medication name",
    "dosage":      "e.g. 500 mg",
    "timing":      ["morning_after_breakfast", "night_after_dinner"],
    "durationDays": 5,
    "instructions": "e.g. Take with warm water. Avoid alcohol."
  }
]

timing values must be one or more of:
morning_before_breakfast | morning_after_breakfast |
afternoon_before_lunch   | afternoon_after_lunch   |
evening | night_before_dinner | night_after_dinner | sos

Return an empty array [] if no medications are discussed.`);
    try {
      const parsed = extractJson(raw, true);
      return { prescription: Array.isArray(parsed) ? parsed : [] };
    } catch {
      return { prescription: [] };
    }
  }

  // ── Build graph ───────────────────────────────────────────────────────────
  const graph = new StateGraph(ClinicalState)
    .addNode('soapNode',         soapNode)
    .addNode('vitalsNode',       vitalsNode)
    .addNode('icdNode',          icdNode)
    .addNode('prescriptionNode', prescriptionNode)
    // Fan out from START to all four nodes in parallel
    .addEdge(START, 'soapNode')
    .addEdge(START, 'vitalsNode')
    .addEdge(START, 'icdNode')
    .addEdge(START, 'prescriptionNode')
    // All nodes converge to END
    .addEdge('soapNode',         END)
    .addEdge('vitalsNode',       END)
    .addEdge('icdNode',          END)
    .addEdge('prescriptionNode', END);

  return graph.compile();
}

// ─── Cached compiled graph ────────────────────────────────────────────────────
let _compiledGraph = null;
async function getClinicalGraph() {
  if (!_compiledGraph) _compiledGraph = await buildClinicalGraph();
  return _compiledGraph;
}

// ─── Master pipeline function ──────────────────────────────────────────────────

/**
 * Run the full voice → clinical note pipeline and persist results.
 *
 * @param {Buffer} audioBuffer     - Raw audio bytes from multer
 * @param {string} originalName    - Original filename (used for extension)
 * @param {string} sessionId       - MongoDB _id or sessionId string of the Session
 * @param {string} doctorId        - MongoDB _id of the logged-in doctor
 * @param {object} [opts]
 * @param {string}   [opts.language_code="en-IN"]  - Sarvam language code
 * @returns {Promise<ClinicalPipelineResult>}
 */
async function runVoicePipeline(audioBuffer, originalName = 'audio.wav', sessionId, doctorId, opts = {}) {
  const languageCode = opts.language_code || 'en-IN';

  // ── 1. Resolve Session ────────────────────────────────────────────────────
  const session = await resolveSession(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.doctorId.toString() !== doctorId.toString()) {
    throw Object.assign(new Error('Unauthorized: session does not belong to you'), { statusCode: 403 });
  }

  // ── 2. Write audio to temp file ───────────────────────────────────────────
  const ext = /\.mp3$/i.test(originalName) ? '.mp3' : /\.m4a$/i.test(originalName) ? '.m4a' : '.wav';
  const tmpPath = path.join(os.tmpdir(), `voice_${Date.now()}${ext}`);
  fs.writeFileSync(tmpPath, audioBuffer);

  let transcriptData;
  try {
    // ── 3. Transcribe with diarization ─────────────────────────────────────
    transcriptData = await transcribeWithDiarization(tmpPath, { language_code: languageCode });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
  }

  const { full_text, language, speakers } = transcriptData;

  if (!full_text || full_text.trim().length === 0) {
    throw Object.assign(new Error('Transcription returned empty text. Please record again.'), { statusCode: 422 });
  }

  // ── 4. Run LangGraph clinical pipeline ───────────────────────────────────
  const clinicalGraph = await getClinicalGraph();
  const pipelineResult = await clinicalGraph.invoke({ transcriptText: full_text });

  const { soap, vitals, icd_codes, prescription } = pipelineResult;

  // ── 5. Persist Transcript document ───────────────────────────────────────
  const transcriptDoc = await Transcript.create({
    transcriptId: `TRS-${uuidv4().slice(0, 8).toUpperCase()}`,
    language,
    data: {
      full_text,
      speakers,
    },
    recordId: null, // will be set after finalization
  });

  // ── 6. Update Session draft data ──────────────────────────────────────────
  await Session.findByIdAndUpdate(session._id, {
    transcriptId: transcriptDoc._id,
    status: 'ongoing', // keep ongoing until doctor finalizes
    draftData: {
      soapNote:    soap,
      vitals:      vitals || {},
      icd10Codes:  icd_codes || [],
      medicines:   prescription || [],
      savedAt:     new Date(),
      aiGenerated: true,
    },
  }, { new: true });

  // ── 7. Return structured result ───────────────────────────────────────────
  return {
    transcript: { full_text, language, speakers },
    soap:         soap    || { subjective: '', objective: '', assessment: '', plan: '' },
    vitals:       vitals  || {},
    icd_codes:    icd_codes    || [],
    prescription: prescription || [],
    transcriptId: transcriptDoc._id,
    sessionId:    session._id,
  };
}

// ─── Session resolver (accepts _id or sessionId string) ──────────────────────
async function resolveSession(identifier) {
  if (!identifier) return null;
  const isObjectId = /^[a-f\d]{24}$/i.test(String(identifier));
  if (isObjectId) {
    const byId = await Session.findById(identifier);
    if (byId) return byId;
  }
  return Session.findOne({ sessionId: String(identifier) });
}

module.exports = { runVoicePipeline };
