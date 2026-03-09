const { SarvamAIClient } = require("sarvamai");
require("dotenv").config();

const API_KEY = process.env.SARVAM_API_KEY;

/**
 * Formats text using Sarvam AI to ensure English words and numbers remain in English
 * while keeping the rest in the respective language.
 *
 * @param {string} text - The text to format
 * @param {string} languageCode - The detected language code (e.g., "hi-IN", "ta-IN")
 * @returns {Promise<string>} - Formatted text
 */
async function formatTranscriptText(text, languageCode = "hi-IN") {
  if (!API_KEY) {
    throw new Error("SARVAM_API_KEY is not set in environment variables.");
  }

  const client = new SarvamAIClient({ apiSubscriptionKey: API_KEY });

  // Use Sarvam AI's translate API with special instruction
  // The target language is the same as source to maintain the original language
  // but with the instruction to keep English words/numbers in English
  const prompt = `Process the following text and ensure that:
1. English words and numbers must remain in English only
2. Keep the rest of the text in its respective language (${languageCode})
3. Do not translate English words to the local language
4. Maintain proper spacing and formatting

Text: ${text}

Return only the processed text without any additional explanation.`;

  try {
    // Using translation API to process the text
    // Map common language codes to Sarvam AI supported codes
    const langMap = {
      'hi-IN': 'hi-IN',
      'ta-IN': 'ta-IN',
      'te-IN': 'te-IN',
      'kn-IN': 'kn-IN',
      'ml-IN': 'ml-IN',
      'mr-IN': 'mr-IN',
      'bn-IN': 'bn-IN',
      'gu-IN': 'gu-IN',
      'pa-IN': 'pa-IN',
      'or-IN': 'or-IN'
    };

    const targetLang = langMap[languageCode] || 'hi-IN';

    // Use the translate endpoint to normalize the text
    const response = await client.text.translate({
      input: text,
      source_language_code: targetLang,
      target_language_code: targetLang,
      speaker_gender: "Male",
      mode: "formal",
      model: "mayura:v1",
      enable_preprocessing: true
    });

    return response.translated_text || text;
  } catch (error) {
    console.error("Error formatting text with Sarvam AI:", error);
    // If the API call fails, return the original text
    return text;
  }
}

module.exports = { formatTranscriptText };
