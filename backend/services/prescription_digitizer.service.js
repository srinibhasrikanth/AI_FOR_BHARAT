/**
 * prescription_digitizer.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates the full Prescription Image → Structured Data pipeline:
 *
 *   1. Receives an image buffer (JPG/PNG/WEBP/HEIC) from the patient.
 *   2. Runs a LangGraph StateGraph (Optiic OCR → Sarvam LLM) with:
 *
 *      Graph topology:
 *
 *        START ──► ocrNode (Optiic) → rawText
 *                      └──┬──► parseMedicinesNode → medicines[]  (sarvam-m)
 *                         ├──► icdNode            → icd_codes[] (sarvam-m)
 *                         └──► metadataNode       → metadata     (sarvam-m)
 *                                   └──► END (all three converge)
 *
 *   3. Performs inventory matching: fuzzy-matches each extracted medicine
 *      name against the Medicine collection and attaches match metadata.
 *   4. Saves a Prescription document (data.source = 'patient_upload') in MongoDB.
 *
 * Output shape:
 * {
 *   rawText     : string,
 *   metadata    : { prescribedBy, date, patientName, clinicName, diagnosis },
 *   medicines   : [{ name, dosage, timing[], durationDays, instructions,
 *                    medicineId?, inventoryName?, cost?, availableQty?,
 *                    matchConfidence: 'exact'|'partial'|'none' }],
 *   icd_codes   : [{ code, description }],
 *   prescription: <saved Prescription document>
 * }
 */

'use strict';

const { v4: uuidv4 }          = require('uuid');
const { SarvamAIClient }       = require('sarvamai');
const { extractTextFromImage } = require('../ai_services/prescription_ocr');
const Prescription             = require('../models/Prescription.model');
const Medicine                 = require('../models/Medicine.model');
require('dotenv').config();

// ─── Sarvam LLM helper ─────────────────────────────────────────────────────────
function getSarvamClient() {
  if (!process.env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not set.');
  return new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
}

async function callSarvamLLM(prompt) {
  const client   = getSarvamClient();
  const response = await client.chat.completions({
    messages: [{ role: 'user', content: prompt }],
    model: 'sarvam-m',
  });
  return response.choices[0].message.content || '';
}

function stripFences(text = '') {
  // Strip <think>...</think> chain-of-thought blocks (sarvam-m reasoning traces)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  // If still not starting with { or [, extract the first JSON structure.
  // IMPORTANT: check for array [ before object { so arrays are not sliced to first element.
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (arrMatch) cleaned = arrMatch[0].trim();
    else if (objMatch) cleaned = objMatch[0].trim();
  }
  return cleaned;
}

// ─── LangGraph state + graph ───────────────────────────────────────────────────
/**
 * Topology (LLM-only — OCR runs outside the graph):
 *   START → parseMedicinesNode (sarvam-m) [parallel]
 *   START → icdNode            (sarvam-m) [parallel]
 *   START → metadataNode       (sarvam-m) [parallel]
 *   All three → END
 */
async function buildDigitizerGraph() {
  const { StateGraph, END, START, Annotation } = require('@langchain/langgraph');

  const DigitizerState = Annotation.Root({
    rawText:   Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
    metadata:  Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
    medicines: Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
    icd_codes: Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  });

  // NOTE: OCR is intentionally run OUTSIDE the graph (in digitizePrescription)
  // so that the binary imageBuffer never travels through LangGraph state,
  // avoiding Buffer → plain-object serialisation that corrupts PDF uploads.

  // ── Node: Parse medicines (sarvam-m) ────────────────────────────────────────
  async function parseMedicinesNode(state) {
    const raw = await callSarvamLLM(`You are a clinical pharmacist. Parse all medicines from this prescription transcript.

Prescription text:
"""
${state.rawText}
"""

Return ONLY a valid JSON array (no markdown fences, no extra text). Each element:
[
  {
    "name"        : "Generic or brand medicine name",
    "dosage"      : "e.g. 500 mg, 10 mg/5ml",
    "timing"      : ["morning_after_breakfast", "night_after_dinner"],
    "durationDays": 5,
    "instructions": "e.g. Take with warm water. Avoid alcohol."
  }
]

timing values must be one or more of:
morning_before_breakfast | morning_after_breakfast |
afternoon_before_lunch   | afternoon_after_lunch   |
evening | night_before_dinner | night_after_dinner | sos

Return [] if no medicines are mentioned.`);

    console.log('[parseMedicinesNode] raw LLM response:', raw?.slice(0, 500));
    const cleaned = stripFences(raw);
    console.log('[parseMedicinesNode] after stripFences:', cleaned?.slice(0, 500));

    try {
      const parsed = JSON.parse(cleaned);
      const result = Array.isArray(parsed) ? parsed : [];
      console.log('[parseMedicinesNode] parsed medicines count:', result.length);
      return { medicines: result };
    } catch (e) {
      console.error('[parseMedicinesNode] JSON.parse failed:', e.message, '| cleaned:', cleaned?.slice(0, 300));
      return { medicines: [] };
    }
  }

  // ── Node: ICD-10 codes (sarvam-m) ───────────────────────────────────────────
  async function icdNode(state) {
    const raw = await callSarvamLLM(`Based on this prescription text, suggest the most relevant ICD-10 codes.

Prescription text:
"""
${state.rawText}
"""

Return ONLY a valid JSON array (no markdown fences, no extra text). Each element:
[
  { "code": "ICD-10 code e.g. J06.9", "description": "Plain-English description" }
]

Suggest 1-5 codes with high confidence. Return [] if no diagnosis is implied.`);
    try {
      const parsed = JSON.parse(stripFences(raw));
      return { icd_codes: Array.isArray(parsed) ? parsed : [] };
    } catch {
      return { icd_codes: [] };
    }
  }

  // ── Node: Metadata extraction (sarvam-m) ────────────────────────────────────
  async function metadataNode(state) {
    const raw = await callSarvamLLM(`You are a medical data extractor. From the following prescription transcript, extract structured metadata.

Prescription text:
"""
${state.rawText}
"""

Return ONLY valid JSON (no markdown fences) with this exact schema:
{
  "prescribedBy" : "Doctor name or null",
  "clinicName"   : "Hospital/clinic name or null",
  "date"         : "Prescription date as ISO string e.g. 2024-03-15, or null",
  "patientName"  : "Patient name on prescription or null",
  "diagnosis"    : "Diagnosis or chief complaint or null"
}

Use null for any field not found in the text.`);
    try {
      return { metadata: JSON.parse(stripFences(raw)) };
    } catch {
      return { metadata: { prescribedBy: null, clinicName: null, date: null, patientName: null, diagnosis: null } };
    }
  }

  // ── Build & compile graph ────────────────────────────────────────────────────
  const graph = new StateGraph(DigitizerState)
    .addNode('parseMedicinesNode', parseMedicinesNode)
    .addNode('icdNode',            icdNode)
    .addNode('metadataNode',       metadataNode)
    // Parallel fan-out: all three LLM nodes run concurrently on rawText
    .addEdge(START, 'parseMedicinesNode')
    .addEdge(START, 'icdNode')
    .addEdge(START, 'metadataNode')
    // Converge
    .addEdge('parseMedicinesNode', END)
    .addEdge('icdNode',            END)
    .addEdge('metadataNode',       END);

  return graph.compile();
}

// ─── Cached compiled graph ────────────────────────────────────────────────────
let _compiledDigitizerGraph = null;
async function getDigitizerGraph() {
  if (!_compiledDigitizerGraph) _compiledDigitizerGraph = await buildDigitizerGraph();
  return _compiledDigitizerGraph;
}

// ─── Inventory matching ───────────────────────────────────────────────────────
async function matchToInventory(medicines) {
  if (!medicines || medicines.length === 0) return [];

  return Promise.all(
    medicines.map(async (med) => {
      const name = (med.name || '').trim();
      if (!name) return { ...med, matchConfidence: 'none' };

      // Exact match (case-insensitive)
      const exact = await Medicine.findOne({
        name: { $regex: `^${name}$`, $options: 'i' },
      }).lean();

      if (exact) {
        return {
          ...med,
          medicineId:      exact._id,
          inventoryName:   exact.name,
          cost:            exact.cost,
          availableQty:    exact.quantity,
          matchConfidence: 'exact',
        };
      }

      // Partial match
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const partial = await Medicine.findOne({
        name: { $regex: escapedName, $options: 'i' },
      }).lean();

      if (partial) {
        return {
          ...med,
          medicineId:      partial._id,
          inventoryName:   partial.name,
          cost:            partial.cost,
          availableQty:    partial.quantity,
          matchConfidence: 'partial',
        };
      }

      return { ...med, matchConfidence: 'none' };
    })
  );
}

// ─── Master digitizer function ────────────────────────────────────────────────
/**
 * @param {Buffer} imageBuffer  - Raw image bytes from multer
 * @param {string} mimeType     - e.g. 'image/jpeg', 'image/png'
 * @param {string} patientId    - MongoDB _id of the logged-in patient
 */
async function digitizePrescription(imageBuffer, mimeType, patientId) {
  // 1a. OCR — run directly so the binary buffer never enters LangGraph state
  //     (LangGraph serialises state during parallel fan-out; a Buffer becomes
  //      a plain {type:'Buffer',data:[...]} object which corrupts PDF uploads)
  const safeBuffer = Buffer.isBuffer(imageBuffer)
    ? imageBuffer
    : Buffer.from(imageBuffer.data ?? imageBuffer);
  const { rawText: ocrText } = await extractTextFromImage(safeBuffer, mimeType);

  // 1b. Run LangGraph pipeline (Sarvam LLM ×3) in parallel, passing rawText only
  const graph  = await getDigitizerGraph();
  const result = await graph.invoke({ rawText: ocrText });

  const rawText = ocrText;
  const { metadata, icd_codes } = result;
  let   { medicines }           = result;

  // 2. Enrich medicines with inventory data
  medicines = await matchToInventory(medicines);

  // 3. Persist prescription document
  const prescription = await Prescription.create({
    prescriptionId: uuidv4(),
    patientId,
    doctorId: null,
    recordId: null,
    data: {
      source:             'patient_upload',
      rawText,
      metadata,
      icd10Codes:         icd_codes,
      // NOTE: stored as `digitizedMedicines`, NOT `consultationMedicines`.
      // `consultationMedicines` is reserved exclusively for doctor-created
      // prescriptions so the frontend dose tracker ignores uploaded PDFs.
      digitizedMedicines: medicines.map((m) => ({
        name:            m.inventoryName || m.name,
        dosage:          m.dosage,
        timing:          m.timing,
        durationDays:    m.durationDays,
        instructions:    m.instructions,
        matchConfidence: m.matchConfidence,
      })),
    },
    medicines: medicines
      .filter((m) => m.medicineId)
      .map((m) => ({
        medicineId:   m.medicineId,
        name:         m.inventoryName || m.name,
        dosage:       m.dosage,
        durationDays: m.durationDays,
        time: (m.timing || []).filter((t) =>
          ['morning_before_breakfast', 'morning_after_breakfast',
           'afternoon_before_lunch',   'afternoon_after_lunch',
           'evening', 'night_before_dinner', 'night_after_dinner', 'sos'].includes(t)
        ),
        instructions: m.instructions || null,
      })),
  });

  return { rawText, metadata, medicines, icd_codes, prescription };
}

module.exports = { digitizePrescription };
