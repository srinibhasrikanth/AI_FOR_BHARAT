/**
 * translate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Translates a clinical SOAP note to a patient-friendly summary in the
 * target language using a two-step approach:
 *
 *   Step 1 – Gemini simplifies the clinical note to plain English at a 6th-grade
 *             reading level, preserving medication timing and safety warnings.
 *
 *   Step 2 – Sarvam AI translates each text field to the target language
 *             (skipped when the target is English).
 *
 * Returns:
 * {
 *   original        : <soapNote as passed in>,
 *   targetLanguage  : "hi-IN" | "te-IN" | ...,
 *   translated      : {
 *     summary               : string,
 *     diagnosis             : string,
 *     instructions          : string,
 *     medications           : [{ name, timing, duration, instructions }],
 *     warnings              : string[],
 *     followUp              : string,
 *     // _translated suffixed copies of fields for non-English targets
 *     summary_translated?   : string,
 *     diagnosis_translated? : string,
 *     ...
 *   }
 * }
 */

const { SarvamAIClient } = require('sarvamai');

require('dotenv').config();

// ─── Language code map ────────────────────────────────────────────────────────
const LANG_CODES = {
  hindi:     'hi-IN',
  telugu:    'te-IN',
  kannada:   'kn-IN',
  tamil:     'ta-IN',
  bengali:   'bn-IN',
  marathi:   'mr-IN',
  gujarati:  'gu-IN',
  punjabi:   'pa-IN',
  odia:      'or-IN',
  malayalam: 'ml-IN',
  english:   'en-IN',
  // pass-through if already a code
  'hi-IN': 'hi-IN', 'te-IN': 'te-IN', 'kn-IN': 'kn-IN',
  'ta-IN': 'ta-IN', 'bn-IN': 'bn-IN', 'mr-IN': 'mr-IN',
  'gu-IN': 'gu-IN', 'pa-IN': 'pa-IN', 'or-IN': 'or-IN',
  'ml-IN': 'ml-IN', 'en-IN': 'en-IN',
};

function resolveLangCode(lang) {
  return LANG_CODES[(lang || 'en-IN').toLowerCase()] ?? lang;
}

// ─── Sarvam LLM helper ─────────────────────────────────────────────────────────────────
function getSarvamClient() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not set in environment.');
  return new SarvamAIClient({ apiSubscriptionKey: key });
}

async function callSarvamLLM(prompt) {
  const client = getSarvamClient();
  const response = await client.chat.completions({
    messages: [{ role: 'user', content: prompt }],
    model: 'sarvam-m',
  });
  return response.choices[0].message.content || '';
}

function stripJsonFences(text = '') {
  // Strip <think>...</think> chain-of-thought blocks (sarvam-m reasoning traces)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  // If still not valid JSON, try to extract the first {...} block
  if (!cleaned.startsWith('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0].trim();
  }
  return cleaned;
}

// ─── Step 1 – Simplify to plain English via Sarvam LLM ─────────────────────────────────
async function simplifyToEnglish(soapNote, icdCodes = [], prescription = [], patientName = '') {
  const prompt = `You are a clinical translator converting a doctor's SOAP note into a simple patient health summary.

STRICT RULES:
- Use 6th-grade reading level (avoid medical jargon).
- Be warm, reassuring, and clear.
- Include each medication with: name, timing (morning/afternoon/evening/night), before or after food, duration in days.
- Include any safety warnings (allergy risks, drug interactions, side effects).
- Mention follow-up if present in the plan.

SOAP Note:
${JSON.stringify(soapNote, null, 2)}

ICD-10 Codes: ${JSON.stringify(icdCodes)}
Prescription Suggestions: ${JSON.stringify(prescription)}
Patient name: ${patientName || 'the patient'}

Return ONLY valid JSON (no markdown fences) matching this schema exactly:
{
  "summary": "2-3 sentence plain-English overview",
  "diagnosis": "Simple explanation of what is wrong",
  "instructions": "What the patient should do (diet, rest, activities to avoid)",
  "medications": [
    {
      "name": "Medicine name",
      "timing": "e.g., morning after breakfast and night after dinner",
      "duration": "e.g., 5 days",
      "instructions": "e.g., Take with water. Do not crush."
    }
  ],
  "warnings": ["Warning sentence 1", "Warning sentence 2"],
  "followUp": "When to return or seek emergency care"
}`;

  const raw = await callSarvamLLM(prompt);

  try {
    return JSON.parse(stripJsonFences(raw));
  } catch {
    console.warn('[translate] Failed to parse Sarvam JSON, returning raw text as summary');
    return {
      summary: raw,
      diagnosis: '',
      instructions: '',
      medications: [],
      warnings: [],
      followUp: '',
    };
  }
}

// ─── Step 2 – Translate text fields via Sarvam AI ────────────────────────────
const TEXT_FIELDS = ['summary', 'diagnosis', 'instructions', 'followUp'];

async function translateFields(simplified, targetLangCode) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    console.warn('[translate] SARVAM_API_KEY not set – returning English-only result');
    return simplified;
  }

  const client = new SarvamAIClient({ apiSubscriptionKey: key });
  const out = { ...simplified };

  const translateOne = async (text) => {
    if (!text) return '';
    try {
      const resp = await client.text.translate({
        input: text,
        source_language_code: 'en-IN',
        target_language_code: targetLangCode,
        speaker_gender: 'Female',
        mode: 'formal',
        model: 'mayura:v1',
        enable_preprocessing: true,
      });
      return resp.translated_text || text;
    } catch (err) {
      console.error('[translate] Sarvam translate error:', err.message);
      return text;
    }
  };

  // Plain text fields
  for (const field of TEXT_FIELDS) {
    if (simplified[field]) {
      out[`${field}_translated`] = await translateOne(simplified[field]);
    }
  }

  // Medications
  out.medications = await Promise.all(
    (simplified.medications || []).map(async (med) => ({
      ...med,
      timing_translated:       await translateOne(med.timing),
      instructions_translated: await translateOne(med.instructions),
    }))
  );

  // Warnings
  out.warnings_translated = await Promise.all(
    (simplified.warnings || []).map(translateOne)
  );

  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Translate a clinical SOAP note into a patient-friendly summary.
 *
 * @param {object} soapNote        - { subjective, objective, assessment, plan }
 * @param {string} targetLanguage  - Language name ("hindi") or BCP-47 code ("hi-IN")
 * @param {object} [opts]
 * @param {string}   [opts.patientName]
 * @param {string[]} [opts.icdCodes]
 * @param {Array}    [opts.prescription]
 * @returns {Promise<{ original, targetLanguage, translated }>}
 */
async function translateClinicalNote(soapNote, targetLanguage = 'en-IN', opts = {}) {
  const { patientName = '', icdCodes = [], prescription = [] } = opts;
  const targetCode = resolveLangCode(targetLanguage);

  // Step 1 – Simplify
  const simplified = await simplifyToEnglish(soapNote, icdCodes, prescription, patientName);

  // Step 2 – Translate if not English
  const translated =
    targetCode === 'en-IN'
      ? simplified
      : await translateFields(simplified, targetCode);

  return {
    original: soapNote,
    targetLanguage: targetCode,
    translated,
  };
}

module.exports = { translateClinicalNote };
