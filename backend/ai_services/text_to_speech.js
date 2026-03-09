const { SarvamAIClient } = require("sarvamai");
require("dotenv").config();

const API_KEY = process.env.SARVAM_API_KEY;

// Language-appropriate default speakers for Sarvam AI bulbul:v2
// Valid v2 speakers: anushka, manisha, vidya, arya (female) | abhilash, karun, hitesh (male)
const DEFAULT_SPEAKERS = {
  "hi-IN": "anushka",
  "te-IN": "anushka",
  "en-IN": "anushka",
};

/**
 * Synthesizes speech from text using Sarvam AI's TTS API.
 *
 * @param {string} text - The text to synthesize (max ~500 chars per call)
 * @param {string} [languageCode="en-IN"] - BCP-47 language code (e.g. "hi-IN", "te-IN")
 * @param {string} [speaker] - Speaker voice name; defaults to a suitable speaker for the language
 * @returns {Promise<{ audio: string }>} base64-encoded WAV audio string
 */
async function synthesizeSpeech(text, languageCode = "en-IN", speaker) {
  if (!API_KEY) {
    throw new Error("SARVAM_API_KEY is not set in environment variables.");
  }

  const client = new SarvamAIClient({ apiSubscriptionKey: API_KEY });

  const chosenSpeaker = speaker || DEFAULT_SPEAKERS[languageCode] || "anushka";

  const response = await client.textToSpeech.convert({
    text: text,
    target_language_code: languageCode,
    speaker: chosenSpeaker,
    model: "bulbul:v2",
  });

  // HttpResponsePromise auto-unwraps on await: resolves directly to the response body { audios: string[] }
  const audioBase64 = response.audios?.[0];
  if (!audioBase64) {
    throw new Error("Sarvam AI TTS returned no audio data.");
  }

  return { audio: audioBase64 };
}

module.exports = { synthesizeSpeech };
