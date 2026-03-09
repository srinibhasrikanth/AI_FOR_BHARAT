const { SarvamAIClient } = require("sarvamai");
const fs = require("fs");
require("dotenv").config();

const API_KEY = process.env.SARVAM_API_KEY;

// Language display names used inside the prompt
const LANGUAGE_NAMES = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "te-IN": "Telugu",
};

/**
 * Builds a structured prompt for patient voice signup transcription.
 * Instructs Sarvam AI to strictly format phone numbers, gender, and date of birth
 * regardless of the spoken language.
 *
 * @param {string} [languageCode="en-IN"] - Sarvam language code (en-IN / hi-IN / te-IN)
 * @returns {string} Prompt string to pass to the transcription API
 */
function buildSignupTranscriptionPrompt(languageCode = "en-IN") {
  const langName = LANGUAGE_NAMES[languageCode] || "English";
  return (
    `You are transcribing a patient voice signup form. The user is speaking in ${langName}. ` +
    `The user may say a phone number, a gender, or a date of birth. ` +
    `UNIVERSAL RULES that apply for ALL inputs regardless of whether the spoken language is English, Hindi, or Telugu: ` +
    `no full stops, no periods, no dashes, no slashes, no country codes, no parentheses, no punctuation of any kind, ` +
    `no extra symbols, no explanations — output only the plain formatted value. ` +
    `Never add a full stop or period at the end or anywhere in the output for any field including names.\n` +
    `1. PHONE NUMBER: Extract exactly 10 digits. Output only the 10 digits using English numerals (0-9). ` +
    `No spaces, dashes, country codes, parentheses, or any other symbols — ` +
    `whether spoken in English, Hindi, or Telugu, always convert spoken digits to English numerals.\n` +
    `2. GENDER: Map the spoken input to the nearest of these exact English values only: ` +
    `"male", "female", "others", "prefer not to say". ` +
    `No punctuation, no extra words, no symbols — applies for English, Hindi, and Telugu input.\n` +
    `3. DATE OF BIRTH: Format strictly as DDMMYYYY using English digits only. ` +
    `Example: "15 March 1990" → "15031990". No spaces, slashes, dashes, or any other symbols. ` +
    `Whether spoken in English, Hindi, or Telugu, always convert the date to this exact 8-digit English format.`
  );
}

/**
 * Transcribes an audio file to text using Sarvam AI's speech-to-text API.
 *
 * @param {string} filePath - Absolute or relative path to the audio file (.wav or .mp3)
 * @param {Object} [options={}] - Optional transcription options
 * @param {string} [options.model="saaras:v3"] - Model to use for transcription
 * @param {string} [options.mode="transcribe"] - Transcription mode
 * @param {string} [options.prompt] - Optional context/vocabulary hints to improve transcription accuracy
 * @returns {Promise<{
 *   request_id: string,
 *   transcript: string,
 *   timestamps: object|null,
 *   diarized_transcript: object|null,
 *   language_code: string,
 *   language_probability: number
 * }>} Transcription response from Sarvam AI
 */
async function transcribeAudio(filePath, options = {}) {
  if (!API_KEY) {
    throw new Error("SARVAM_API_KEY is not set in environment variables.");
  }

  const client = new SarvamAIClient({ apiSubscriptionKey: API_KEY });

  // The SDK's transcribe() takes a single request object: { file, model, mode }
  // and expects `file` to be a ReadStream (as shown in the SDK's own JSDoc example).
  const response = await client.speechToText.transcribe({
    file: fs.createReadStream(filePath),
    model: options.model || "saaras:v3",
    mode: options.mode || "transcribe",
    language_code: options.language_code || "en-IN",
    ...(options.prompt && { prompt: options.prompt }),
  });

  // Strip full stops and punctuation the model adds regardless of the prompt
  if (response.transcript) {
    response.transcript = sanitizeTranscript(response.transcript);
  }

  return response;
}

/**
 * Removes full stops, trailing punctuation, and other unwanted symbols
 * that Sarvam AI may append to transcripts regardless of the prompt.
 * Preserves internal spaces (needed for names) and hyphens inside words.
 *
 * @param {string} text
 * @returns {string}
 */
function sanitizeTranscript(text) {
  if (!text) return text;
  return text
    // Remove full stops / periods everywhere
    .replace(/\./g, "")
    // Remove other trailing/leading punctuation: , ? ! ; : ' " । (Hindi purna virama) ۔
    .replace(/[,?!;:'"।۔]/g, "")
    // Collapse multiple spaces down to one
    .replace(/\s{2,}/g, " ")
    .trim();
}

module.exports = { transcribeAudio, buildSignupTranscriptionPrompt, sanitizeTranscript };
