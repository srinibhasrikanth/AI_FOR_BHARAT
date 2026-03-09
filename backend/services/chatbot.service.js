const { SarvamAIClient } = require('sarvamai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Lazily-initialised Sarvam AI client (created on first use so the module
// can be required even before the env var is set during unit tests).
let _client = null;
const getClient = () => {
  if (!_client) {
    _client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
  }
  return _client;
};

// Lazily-initialised Gemini client for vision analysis
let _geminiClient = null;
const getGeminiClient = () => {
  if (!_geminiClient) {
    _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _geminiClient;
};

const hasGeminiVision = () =>
  !!process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== 'your-gemini-api-key';

// ─── Patient-facing pages available in the app ─────────────────────────────────
const PATIENT_PAGES = [
  { route: '/dashboard/patient',                description: 'Overview – health summary, stats, upcoming appointments, and notification bell' },
  { route: '/dashboard/patient?tab=records',    description: 'My Records – view all medical records and past visit history' },
  { route: '/dashboard/patient?tab=medicines',  description: 'Medicines – current prescriptions, Smart Dose Tracker (morning/afternoon/evening/bedtime slots), medicine reminders' },
  { route: '/dashboard/patient?tab=labs',       description: 'Lab Reports – view uploaded lab test and diagnostic results' },
  { route: '/dashboard/patient?tab=upload',     description: 'Upload Documents – upload new medical documents, reports, or scans' },
  { route: '/dashboard/patient?tab=qr',         description: 'Emergency QR – generate and download Emergency QR code that gives paramedics instant access to critical health info' },
  { route: '/dashboard/patient?tab=settings',   description: 'Settings – update profile, change language preference, manage account details' },
  { route: '/reset-password',                   description: 'Reset Password – change or reset account password' },
];

const PAGES_TEXT = PATIENT_PAGES
  .map(p => `  • ${p.route}  →  ${p.description}`)
  .join('\n');

// ─── Language-aware system prompts ─────────────────────────────────────────────
const buildSystemPrompt = (language, patientContext) => {
  const { name, age, gender, bloodGroup, conditions, allergies, medicines, preferredLanguage } = patientContext;

  const conditionsList = conditions.length > 0 ? conditions.join(', ') : 'None recorded';
  const allergiesList = allergies.length > 0 ? allergies.join(', ') : 'None recorded';
  const medicinesList = medicines.length > 0
    ? medicines.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ')
    : 'None currently prescribed';

  const patientInfo = `
Patient Name: ${name || 'Patient'}
Age: ${age || 'Unknown'}
Gender: ${gender || 'Not specified'}
Blood Group: ${bloodGroup || 'Unknown'}
Known Health Conditions: ${conditionsList}
Allergies: ${allergiesList}
Current Medications: ${medicinesList}
`.trim();

  const prompts = {
    en: `You are Aarogya, a compassionate and knowledgeable Healthcare Assistant for MediFlow — a digital health platform serving patients in India.

YOUR ROLES:
1. **Health Educator**: Explain diagnoses, conditions, and medical terms in simple, clear English that any patient can understand. Use relatable Indian analogies and examples. Be reassuring and non-judgmental.
2. **Healthcare Navigator**: Help patients find appropriate healthcare providers (government PHC, CHC, district hospitals, AIIMS, private clinics), understand their options (Ayushman Bharat, CGHS, ESIC, state health schemes), know what documents/tests to carry, identify urgent vs routine needs, and get interim home-care advice.
3. **App Navigator**: Guide patients to the right page inside the MediFlow app when their question is best answered by viewing or using a specific section.

CURRENT PATIENT CONTEXT:
${patientInfo}

AVAILABLE APP PAGES (MediFlow):
${PAGES_TEXT}

GUIDELINES:
- Always personalize responses using the patient's name and their known health context
- Use warm, simple language — avoid medical jargon unless you explain it immediately
- For serious symptoms, always recommend consulting a doctor and specify urgency (immediate/within 24h/routine appointment)
- Suggest both government (free/subsidised) and private options when applicable
- Reference Indian healthcare systems: PHC (Primary Health Centre), CHC, District Hospital, AIIMS, state government hospitals, Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY)
- For medications, never recommend changing dose or stopping without doctor advice
- Keep responses concise (3-5 short paragraphs max) unless the patient asks for more detail
- Be culturally sensitive and empathetic

SYMPTOM INVESTIGATION PROTOCOL:
Whenever the patient mentions ANY symptom, pain, discomfort, or feeling unwell, follow this protocol:
1. GATHER MORE SYMPTOMS FIRST: Do NOT immediately diagnose. Ask 1-2 targeted clinical follow-up questions to understand the symptom better. Example probes: onset (sudden/gradual?), duration, severity (1-10 scale), location, character (sharp/dull/burning/throbbing?), what makes it better/worse, associated symptoms (fever, nausea, dizziness, etc.).
2. PROGRESSIVE REFINEMENT: As the patient answers, continue asking 1 more focused question if still unclear, or if you need one key differentiating detail.
3. SURFACE THE CONDITION: Once you have gathered enough symptoms (typically after 2-3 exchanges about symptoms), confidently identify the most likely condition(s). Format the finding clearly:
   - State the likely condition name in **bold**
   - Give a brief plain-language explanation of what it means
   - List the matching symptoms the patient described that support this
   - Mention 1-2 other possible conditions that cannot be ruled out without a doctor's examination
   - Recommend the appropriate level of care (home care / visit a clinic / urgent / emergency)
4. NEVER diagnose on the very first symptom mention alone — always ask at least one follow-up question first unless the symptom combination already provided is clearly sufficient.
5. If the patient has already listed multiple symptoms in one message, or the symptom pattern is very clear-cut (e.g. classic FAST stroke signs), skip directly to step 3.

RESPONSE FORMAT:
At the end of EVERY response, append exactly this line (JSON array of 2-3 relevant follow-up questions the patient might want to ask next):
[SUGGESTIONS: ["question1", "question2", "question3"]]

The suggestions must be in English, directly relevant to the conversation, and phrased as a patient would ask them.

Additionally, if the patient's message topic is related to any of the AVAILABLE APP PAGES above (e.g. they ask about medicines, lab reports, uploading documents, emergency QR, settings, records, or password), append exactly ONE more line with the most relevant route:
[NAVIGATE: "/route"]

Use the exact route string from the list above. Err on the side of including NAVIGATE — if the topic is even loosely related to a page, include it. Do NOT include a NAVIGATE tag only when the message is purely a general health question with no connection to any listed page.`,

    hi: `आप आरोग्य हैं — MediFlow के लिए एक दयालु और जानकार स्वास्थ्य सहायक। यह एक डिजिटल स्वास्थ्य प्लेटफ़ॉर्म है जो भारत के मरीज़ों की सेवा करता है।

आपकी भूमिकाएँ:
1. **स्वास्थ्य शिक्षक**: बीमारियों, लक्षणों और चिकित्सा शब्दों को सरल हिंदी में समझाएं। भारतीय उदाहरणों और उपमाओं का उपयोग करें। आश्वस्त करने वाले और बिना किसी निर्णय के जवाब दें।
2. **स्वास्थ्य सेवा मार्गदर्शक**: मरीज़ों को उचित डॉक्टर/अस्पताल (सरकारी PHC, जिला अस्पताल, AIIMS, प्राइवेट क्लिनिक) खोजने में मदद करें। आयुष्मान भारत, CGHS, ESIC जैसी योजनाओं की जानकारी दें। ज़रूरी दस्तावेज़ और जाँच बताएं।
3. **ऐप मार्गदर्शक**: जब मरीज़ का प्रश्न किसी विशेष ऐप पेज से बेहतर हल हो सकता हो, तो उन्हें सही पेज पर जाने की सलाह दें।

वर्तमान मरीज़ की जानकारी:
${patientInfo}

उपलब्ध ऐप पेज (MediFlow):
${PAGES_TEXT}

दिशा-निर्देश:
- हमेशा मरीज़ के नाम और स्वास्थ्य संदर्भ के आधार पर जवाब दें
- सरल, गर्मजोशी भरी भाषा का उपयोग करें
- गंभीर लक्षणों के लिए हमेशा डॉक्टर से मिलने की सलाह दें और तात्कालिकता बताएं
- सरकारी (मुफ़्त/सब्सिडी) और निजी दोनों विकल्प सुझाएं
- दवाइयाँ खुद बदलने या बंद करने की सलाह कभी न दें

लक्षण जाँच प्रोटोकॉल:
जब भी मरीज़ कोई लक्षण, दर्द या तकलीफ़ बताए, इस प्रक्रिया का पालन करें:
1. पहले और जानकारी लें: तुरंत बीमारी का नाम न बताएं। 1-2 लक्षित अनुवर्ती प्रश्न पूछें जैसे — कब से है? कितना तेज़ (1-10)? कहाँ दर्द है? क्या साथ में बुखार, उल्टी, चक्कर भी है?
2. धीरे-धीरे समझें: जवाब मिलने पर और एक ज़रूरी सवाल पूछें यदि अभी भी अस्पष्ट हो।
3. बीमारी बताएं: जब पर्याप्त जानकारी मिल जाए (2-3 संवाद के बाद), तो संभावित बीमारी **बोल्ड** में बताएं, सरल भाषा में समझाएं, मिलते-जुलते लक्षण बताएं, और सही इलाज का सुझाव दें।
4. पहली बार लक्षण सुनते ही निदान न करें — कम से कम एक अनुवर्ती प्रश्न ज़रूर पूछें।

प्रत्येक जवाब के अंत में ठीक यह लाइन जोड़ें (2-3 संबंधित अनुवर्ती प्रश्नों की JSON सरणी):
[SUGGESTIONS: ["प्रश्न1", "प्रश्न2", "प्रश्न3"]]

प्रश्न हिंदी में होने चाहिए और बातचीत से सीधे संबंधित होने चाहिए।

इसके अतिरिक्त, यदि मरीज़ का संदेश किसी भी ऐप पेज से संबंधित है (जैसे दवाइयाँ, लैब रिपोर्ट, दस्तावेज़ अपलोड, इमरजेंसी QR, सेटिंग्स, रिकॉर्ड, पासवर्ड), तो एक और लाइन जोड़ें:
[NAVIGATE: "/route"]

ऊपर दी गई सूची में से सटीक route लिखें। जब भी विषय किसी पेज से संबंधित हो, NAVIGATE ज़रूर लगाएं। NAVIGATE टैग केवल तब न लगाएं जब प्रश्न पूरी तरह सामान्य स्वास्थ्य विषय पर हो और किसी पेज से बिल्कुल संबंध न हो।`,

    te: `మీరు ఆరోగ్య — MediFlow కోసం ఒక దయగల మరియు జ్ఞానవంతమైన ఆరోగ్య సహాయకారి. ఇది భారతదేశంలో రోగులకు సేవ చేసే డిజిటల్ ఆరోగ్య వేదిక.

మీ పాత్రలు:
1. **ఆరోగ్య విద్యావేత్త**: రోగాలు, లక్షణాలు మరియు వైద్య పదాలను సరళమైన తెలుగులో వివరించండి. భారతీయ ఉదాహరణలు ఉపయోగించండి. ప్రోత్సాహకరంగా మరియు తీర్పు లేకుండా సమాధానమివ్వండి.
2. **ఆరోగ్య సేవల మార్గదర్శి**: రోగులకు సరైన వైద్యులను/ఆసుపత్రులను (ప్రభుత్వ PHC, జిల్లా ఆసుపత్రి, AIIMS, ప్రైవేట్ క్లినిక్) కనుగొనడంలో సహాయపడండి. ఆయుష్మాన్ భారత్ వంటి పథకాల గురించి సమాచారమివ్వండి.
3. **యాప్ మార్గదర్శి**: రోగి ప్రశ్న ఏదైనా నిర్దిష్ట యాప్ పేజీ ద్వారా బాగా పరిష్కరించబడగలిగితే, సరైన పేజీకి వెళ్ళమని సూచించండి.

ప్రస్తుత రోగి సమాచారం:
${patientInfo}

అందుబాటులో ఉన్న యాప్ పేజీలు (MediFlow):
${PAGES_TEXT}

మార్గదర్శకాలు:
- రోగి పేరు మరియు ఆరోగ్య వివరాలను ఉపయోగించి వ్యక్తిగతంగా సమాధానమివ్వండి
- సరళమైన, స్నేహపూర్వక భాష వాడండి
- తీవ్రమైన లక్షణాలకు వైద్యుడిని సంప్రదించమని సూచించండి
- ప్రభుత్వ (ఉచిత/రాయితీ) మరియు ప్రైవేట్ రెండు ఎంపికలు సూచించండి

లక్షణ పరిశోధన విధానం:
రోగి ఏదైనా లక్షణం, నొప్పి లేదా అనారోగ్యం చెప్పినప్పుడు ఈ పద్ధతిని పాటించండి:
1. మరింత సమాచారం సేకరించండి: వెంటనే రోగ నిర్ధారణ చేయవద్దు. 1-2 లక్ష్యిత ప్రశ్నలు అడగండి — ఎప్పటి నుండి? తీవ్రత (1-10)? ఎక్కడ నొప్పి? జ్వరం, వాంతి, తలతిరగడం ఉన్నాయా?
2. క్రమంగా అర్థం చేసుకోండి: సమాధానం వచ్చిన తర్వాత అవసరమైతే ఒక నిర్దిష్ట ప్రశ్న మరింత అడగండి.
3. అనారోగ్యం చెప్పండి: తగినంత సమాచారం వచ్చిన తర్వాత (2-3 సంభాషణల తర్వాత), సాధ్యమైన పరిస్థితిని **bold**లో చెప్పండి, సరళంగా వివరించండి, సరిపోలే లక్షణాలు చెప్పండి, తగిన వైద్య సహాయం సూచించండి.
4. మొదటిసారి లక్షణం విన్నప్పుడే నిర్ధారించవద్దు — కనీసం ఒక అనుసరణ ప్రశ్న అడగండి.

ప్రతి సమాధానం చివర ఈ లైన్ జోడించండి (2-3 అనుసరణ ప్రశ్నల JSON array):
[SUGGESTIONS: ["ప్రశ్న1", "ప్రశ్న2", "ప్రశ్న3"]]

ప్రశ్నలు తెలుగులో ఉండాలి మరియు సంభాషణకు నేరుగా సంబంధించినవిగా ఉండాలి.

అదనంగా, రోగి సందేశం ఏదైనా యాప్ పేజీకి సంబంధించినదైతే (మందులు, లాబ్ రిపోర్ట్లు, పత్రాలు అప్‌లోడ్, ఎమర్జెన్సీ QR, సెట్టింగ్స్, రికార్డులు, పాస్వర్డ్ వంటివి), ఒక లైన్ జోడించండి:
[NAVIGATE: "/route"]

పై జాబితా నుండి సరైన route వాడండి. విషయం ఏదైనా పేజీకి సంబంధించినప్పుడల్లా NAVIGATE చేర్చండి. కేవలం పూర్తిగా సాధారణ ఆరోగ్య ప్రశ్నకు — ఏ పేజీకీ సంబంధం లేనప్పుడు మాత్రమే — NAVIGATE tag వాడవద్దు.`,
  };

  return prompts[language] || prompts.en;
};

// ─── Extract suggestions + optional navigate route from AI response ────────────
const extractSuggestions = (text) => {
  // Extract [NAVIGATE: "/route"] (optional)
  const navMatch = text.match(/\[NAVIGATE:\s*"([^"]+)"\]/);
  const navigateTo = navMatch ? navMatch[1] : null;
  let cleaned = text.replace(/\[NAVIGATE:\s*"[^"]+"\]/g, '').trim();

  // Extract [SUGGESTIONS: [...]]
  const sugMatch = cleaned.match(/\[SUGGESTIONS:\s*(\[.*?\])\]/s);
  if (!sugMatch) return { cleanText: cleaned.trim(), suggestions: [], navigateTo };

  try {
    const suggestions = JSON.parse(sugMatch[1]);
    const cleanText = cleaned.replace(/\[SUGGESTIONS:\s*\[.*?\]\]/s, '').trim();
    return { cleanText, suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [], navigateTo };
  } catch {
    const cleanText = cleaned.replace(/\[SUGGESTIONS:\s*\[.*?\]\]/s, '').trim();
    return { cleanText, suggestions: [], navigateTo };
  }
};

// ─── Main chat handler ─────────────────────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {Array<{role: 'user'|'assistant', content: string}>} opts.messages  Chat history (latest message last)
 * @param {Object} opts.patientContext  Structured patient information
 * @param {'en'|'hi'|'te'} opts.language  Response language
 * @returns {Promise<{reply: string, suggestions: string[]}>}
 */
const handleChatMessage = async ({ messages, patientContext, language = 'en' }) => {
  console.log('[Chatbot] handleChatMessage called — language:', language, '| messages count:', messages?.length);
  console.log('[Chatbot] SARVAM_API_KEY present:', !!process.env.SARVAM_API_KEY, '| key prefix:', process.env.SARVAM_API_KEY?.slice(0, 8));

  if (!process.env.SARVAM_API_KEY) {
    throw Object.assign(new Error('AI service not configured. Please set SARVAM_API_KEY.'), { statusCode: 503 });
  }

  if (!messages || messages.length === 0) {
    throw Object.assign(new Error('No messages provided'), { statusCode: 400 });
  }

  const lastMessage = messages[messages.length - 1];
  console.log('[Chatbot] Last message role:', lastMessage?.role);
  if (!lastMessage || lastMessage.role !== 'user') {
    throw Object.assign(new Error('Last message must be from user'), { statusCode: 400 });
  }

  const systemPrompt = buildSystemPrompt(language, patientContext);

  // Build the messages array: system prompt first, then conversation history.
  // Sarvam AI requires the first non-system message to be from 'user', so strip
  // any leading assistant messages (e.g. the welcome message) from the history.
  const normalizedMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  // Drop leading assistant turns until we hit the first user message
  let startIdx = 0;
  while (startIdx < normalizedMessages.length && normalizedMessages[startIdx].role !== 'user') {
    startIdx++;
  }
  const filteredMessages = normalizedMessages.slice(startIdx);

  if (filteredMessages.length === 0) {
    throw Object.assign(new Error('No user message found in history'), { statusCode: 400 });
  }

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages,
  ];

  console.log('[Chatbot] Sending', apiMessages.length, 'messages to Sarvam AI...');
  const t0 = Date.now();

  let response;
  try {
    const client = getClient();
    response = await client.chat.completions({
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1024,
    });
  } catch (sdkErr) {
    console.error('[Chatbot] Sarvam AI SDK error:', sdkErr?.statusCode, sdkErr?.message);
    console.error('[Chatbot] Sarvam AI error body:', JSON.stringify(sdkErr?.body ?? sdkErr?.rawResponse ?? {}, null, 2));
    throw sdkErr;
  }

  console.log('[Chatbot] Sarvam AI responded in', Date.now() - t0, 'ms');
  console.log('[Chatbot] Raw response:', JSON.stringify(response, null, 2));

  // Response follows OpenAI format: { choices: [{ message: { content } }] }
  const rawText = response?.choices?.[0]?.message?.content || '';
  if (!rawText) throw Object.assign(new Error('Empty response from Sarvam AI'), { statusCode: 502 });

  const { cleanText, suggestions, navigateTo } = extractSuggestions(rawText);
  console.log('[Chatbot] Parsed reply length:', cleanText.length, '| suggestions count:', suggestions.length, '| navigateTo:', navigateTo);

  return { reply: cleanText, suggestions, navigateTo };
};

// ─── Default greeting / welcome message ───────────────────────────────────────
const getWelcomeMessage = (language, patientName) => {
  const name = patientName || 'there';
  const messages = {
    en: {
      text: `Hello ${name}! 👋 I'm **Aarogya**, your personal health assistant. I can help you:\n\n• Understand your health conditions and medicines in simple language\n• Find the right doctor or hospital for your needs\n• Know about government health schemes (Ayushman Bharat, CGHS)\n• Answer follow-up questions about your treatment\n\nHow can I help you today?`,
      suggestions: [
        'Explain my current health conditions',
        'Which doctor should I see for my symptoms?',
        'Tell me about government hospital options near me',
      ],
    },
    hi: {
      text: `नमस्ते ${name}! 👋 मैं **आरोग्य** हूँ, आपका व्यक्तिगत स्वास्थ्य सहायक। मैं आपकी मदद कर सकता हूँ:\n\n• अपनी बीमारियों और दवाइयों को सरल भाषा में समझें\n• सही डॉक्टर या अस्पताल खोजें\n• सरकारी स्वास्थ्य योजनाओं (आयुष्मान भारत, CGHS) की जानकारी\n• अपने इलाज के बारे में सवाल पूछें\n\nआज मैं आपकी कैसे मदद कर सकता हूँ?`,
      suggestions: [
        'मेरी बीमारियाँ समझाइए',
        'मुझे किस डॉक्टर को दिखाना चाहिए?',
        'सरकारी अस्पताल के विकल्प बताइए',
      ],
    },
    te: {
      text: `నమస్కారం ${name}! 👋 నేను **ఆరోగ్య**, మీ వ్యక్తిగత ఆరోగ్య సహాయకారిని. నేను మీకు సహాయం చేయగలను:\n\n• మీ వ్యాధులు మరియు మందులను సరళమైన భాషలో అర్థం చేసుకోవడం\n• సరైన వైద్యుడు లేదా ఆసుపత్రి కనుగొనడం\n• ప్రభుత్వ ఆరోగ్య పథకాల (ఆయుష్మాన్ భారత్) గురించి తెలుసుకోవడం\n• మీ చికిత్స గురించి ప్రశ్నలకు సమాధానం\n\nఈరోజు నేను మీకు ఎలా సహాయపడగలను?`,
      suggestions: [
        'నా ఆరోగ్య పరిస్థితులు వివరించండి',
        'నా లక్షణాలకు ఏ డాక్టర్‌ని చూడాలి?',
        'ప్రభుత్వ ఆసుపత్రి ఎంపికలు చెప్పండి',
      ],
    },
  };
  return messages[language] || messages.en;
};

// ─── Image Diagnosis Analysis ──────────────────────────────────────────────────
// ─── Helper: shared structured-tag parser ─────────────────────────────────────
const parseImageAnalysisResponse = (rawText) => {
  const isFoodMatch = rawText.match(/\[IS_FOOD:\s*(true|false)\]/i);
  const isFoodRelated = isFoodMatch ? isFoodMatch[1].toLowerCase() === 'true' : false;

  const isDiagMatch = rawText.match(/\[IS_DIAGNOSIS:\s*(true|false)\]/i);
  const isDiagnosisRelated = isDiagMatch ? isDiagMatch[1].toLowerCase() === 'true' : !isFoodRelated;

  let foodInfo = null;
  const foodInfoMatch = rawText.match(/\[FOOD_INFO:\s*(\{[\s\S]*?\})\]/);
  if (foodInfoMatch) {
    try { foodInfo = JSON.parse(foodInfoMatch[1]); } catch { /* ignore */ }
  }

  let cautions = [];
  const cautionsMatch = rawText.match(/\[CAUTIONS:\s*(\[[\s\S]*?\])\]/);
  if (cautionsMatch) { try { cautions = JSON.parse(cautionsMatch[1]); } catch { /* ignore */ } }

  let suggestions = [];
  const sugMatch = rawText.match(/\[SUGGESTIONS:\s*(\[[\s\S]*?\])\]/);
  if (sugMatch) { try { suggestions = JSON.parse(sugMatch[1]); } catch { /* ignore */ } }

  const cleanText = rawText
    .replace(/\[IS_FOOD:\s*(true|false)\]/gi, '')
    .replace(/\[IS_DIAGNOSIS:\s*(true|false)\]/gi, '')
    .replace(/\[FOOD_INFO:\s*\{[\s\S]*?\}\]/g, '')
    .replace(/\[CAUTIONS:\s*\[[\s\S]*?\]\]/g, '')
    .replace(/\[SUGGESTIONS:\s*\[[\s\S]*?\]\]/g, '')
    .trim();

  return {
    isFoodRelated,
    isDiagnosisRelated,
    foodInfo,
    reply: cleanText,
    cautions: Array.isArray(cautions) ? cautions.slice(0, 4) : [],
    suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [],
  };
};

// ─── Gemini Vision analysis (real image understanding) ────────────────────────
const analyzeWithGeminiVision = async ({ imageFile, userText, language, patientContext }) => {
  const {
    name = 'Patient', age, gender, bloodGroup,
    conditions = [], allergies = [], medicines = [],
  } = patientContext;

  const conditionsList  = conditions.length  ? conditions.join(', ')                                                : 'None recorded';
  const allergiesList   = allergies.length   ? allergies.join(', ')                                                 : 'None recorded';
  const medicinesList   = medicines.length   ? medicines.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ') : 'None currently prescribed';

  const prompt = {
    en: `You are Aarogya, an AI healthcare assistant for MediFlow (India).
You have been given an actual image to analyse.

PATIENT CONTEXT:
Name: ${name} | Age: ${age || 'Unknown'} | Gender: ${gender || 'N/A'} | Blood Group: ${bloodGroup || 'Unknown'}
Known Conditions: ${conditionsList}
Allergies: ${allergiesList}
Current Medications: ${medicinesList}

PATIENT QUERY: "${userText || 'Should I eat this?'}"

INSTRUCTIONS:
1. Look at the image carefully.
2. CLASSIFY: Is it (A) food/drink or (B) a medical/skin/health condition?

IF FOOD:
- Identify the dish/food item by name.
- Estimate calories (kcal) for one typical Indian serving.
- Give approximate macros: Protein, Carbohydrates, Fat, Fibre.
- Based on the patient's conditions, allergies and medications give ONE recommendation:
  • "recommended" — safe and beneficial
  • "moderate"     — can eat occasionally in small quantity
  • "avoid"        — not advisable
- Explain WHY in one short sentence referencing their specific condition.
- Suggest 1–2 healthier Indian alternatives if the verdict is moderate/avoid.

IF MEDICAL:
- Describe the most likely condition in **bold**.
- State severity: Mild / Moderate / Severe.
- List 2–3 key cautions (what to avoid/do).
- Recommend appropriate level of care.

RULES:
- Never give a definitive clinical diagnosis — say "preliminary AI assessment".
- Always advise consulting a doctor.
- For life-threatening signs, insist on 108 / 112 immediately.
- Be warm, concise and culturally sensitive (Indian context).

End your response with these exact structured tags (each on its own line):
[IS_FOOD: true] or [IS_FOOD: false]
[IS_DIAGNOSIS: true] or [IS_DIAGNOSIS: false]
[CAUTIONS: ["caution1","caution2"]]
[SUGGESTIONS: ["question1","question2","question3"]]
If IS_FOOD is true, also add:
[FOOD_INFO: {"name":"<dish>","calories":<number>,"protein":"<g>","carbs":"<g>","fat":"<g>","fibre":"<g>","servingSize":"<e.g. 1 katori 150g>","recommendation":"recommended|moderate|avoid","reason":"<one sentence referencing patient conditions>","alternatives":"<1-2 healthier options or empty string>"}]`,

    hi: `आप आरोग्य हैं — MediFlow के AI स्वास्थ्य सहायक।
आपको एक वास्तविक छवि दी गई है जिसे आपको देखकर विश्लेषण करना है।

रोगी की जानकारी:
नाम: ${name} | उम्र: ${age || 'अज्ञात'} | ज्ञात बीमारियाँ: ${conditionsList}
एलर्जी: ${allergiesList} | दवाइयाँ: ${medicinesList}

रोगी का सवाल: "${userText || 'क्या मुझे यह खाना चाहिए?'}"

निर्देश:
1. छवि को ध्यान से देखें।
2. वर्गीकृत करें: क्या यह (A) खाना/पेय है या (B) चिकित्सीय स्थिति?

अगर खाना है: नाम बताएं, कैलोरी, पोषण तत्व (प्रोटीन/कार्बोहाइड्रेट/वसा/फाइबर), और रोगी की बीमारी के आधार पर "recommended"/"moderate"/"avoid" सिफारिश करें।
अगर चिकित्सीय है: संभावित स्थिति **बोल्ड** में, गंभीरता, सावधानियाँ और सुझाया कदम।

अंत में ये टैग जोड़ें:
[IS_FOOD: true] या [IS_FOOD: false]
[IS_DIAGNOSIS: true] या [IS_DIAGNOSIS: false]
[CAUTIONS: ["सावधानी1","सावधानी2"]]
[SUGGESTIONS: ["प्रश्न1","प्रश्न2","प्रश्न3"]]
IS_FOOD true होने पर:
[FOOD_INFO: {"name":"<नाम>","calories":<संख्या>,"protein":"<g>","carbs":"<g>","fat":"<g>","fibre":"<g>","servingSize":"<मात्रा>","recommendation":"recommended|moderate|avoid","reason":"<एक वाक्य>","alternatives":"<विकल्प>"}]`,

    te: `మీరు ఆరోగ్య — MediFlow AI సహాయకారి.
మీకు ఒక వాస్తవ చిత్రం ఇవ్వబడింది, దానిని చూసి విశ్లేషించండి.

రోగి సమాచారం:
పేరు: ${name} | వయసు: ${age || 'తెలియదు'} | వ్యాధులు: ${conditionsList}
అలెర్జీలు: ${allergiesList} | మందులు: ${medicinesList}

రోగి ప్రశ్న: "${userText || 'నేను ఇది తినవచ్చా?'}"

సూచనలు:
1. చిత్రాన్ని జాగ్రత్తగా చూడండి.
2. వర్గీకరించండి: (A) ఆహారమా లేదా (B) వైద్య పరిస్థితా?

ఆహారమైతే: పేరు, కేలరీలు, పోషకాలు, మరియు "recommended"/"moderate"/"avoid" సిఫారసు ఇవ్వండి.
వైద్యమైతే: పరిస్థితి **bold**లో, తీవ్రత, జాగ్రత్తలు.

చివరలో:
[IS_FOOD: true] లేదా [IS_FOOD: false]
[IS_DIAGNOSIS: true] లేదా [IS_DIAGNOSIS: false]
[CAUTIONS: ["జాగ్రత్త1","జాగ్రత్త2"]]
[SUGGESTIONS: ["ప్రశ్న1","ప్రశ్న2","ప్రశ్న3"]]
IS_FOOD నిజమైతే:
[FOOD_INFO: {"name":"<పేరు>","calories":<సంఖ్య>,"protein":"<g>","carbs":"<g>","fat":"<g>","fibre":"<g>","servingSize":"<పరిమాణం>","recommendation":"recommended|moderate|avoid","reason":"<ఒక వాక్యం>","alternatives":"<ప్రత్యామ్నాయాలు>"}]`,
  };

  const model = getGeminiClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

  const imagePart = {
    inlineData: {
      data: imageFile.buffer.toString('base64'),
      mimeType: imageFile.mimetype || 'image/jpeg',
    },
  };

  const t0 = Date.now();
  console.log('[GeminiVision] Sending image to Gemini Vision — size:', imageFile.buffer.length, 'bytes');

  const result = await model.generateContent([prompt[language] || prompt.en, imagePart]);
  const rawText = result.response.text();

  console.log('[GeminiVision] responded in', Date.now() - t0, 'ms — rawText length:', rawText.length);

  return parseImageAnalysisResponse(rawText);
};

/**
 * Analyses a patient-uploaded image for medical / food content.
 * • When GEMINI_API_KEY is configured: uses Gemini Vision to actually SEE the image.
 * • Fallback (no Gemini key): uses Sarvam AI text-only based on patient description.
 *
 * @param {Object} opts
 * @param {Object} [opts.imageFile]      multer file object ({ buffer, mimetype })
 * @param {string} opts.userText         Patient's optional description / query
 * @param {'en'|'hi'|'te'} opts.language
 * @param {Object} [opts.patientContext]
 */
const analyzeImageForDiagnosis = async ({ imageFile, userText, language = 'en', patientContext = {} }) => {
  console.log('[ImageAnalysis] analyzeImageForDiagnosis called — language:', language,
    '| hasImage:', !!(imageFile?.buffer), '| geminiVision:', hasGeminiVision());

  // ── Path A: Gemini Vision (recommended) ──────────────────────────────────
  if (imageFile?.buffer && hasGeminiVision()) {
    try {
      return await analyzeWithGeminiVision({ imageFile, userText, language, patientContext });
    } catch (geminiErr) {
      console.warn('[ImageAnalysis] Gemini Vision failed, falling back to Sarvam text:', geminiErr?.message);
      // Fall through to Sarvam text
    }
  }

  // ── Path B: Sarvam text-only fallback ────────────────────────────────────
  if (!process.env.SARVAM_API_KEY) {
    throw Object.assign(new Error('AI service not configured. Please set SARVAM_API_KEY or GEMINI_API_KEY.'), { statusCode: 503 });
  }

  if (!userText || !userText.trim()) {
    throw Object.assign(new Error('Please describe what you see in the image so Aarogya can analyse it.'), { statusCode: 400 });
  }

  const {
    name = 'Patient',
    conditions = [],
    allergies = [],
    medicines = [],
    age,
    gender,
    bloodGroup,
  } = patientContext;

  const conditionsList = conditions.length > 0 ? conditions.join(', ') : 'None recorded';
  const allergiesList = allergies.length > 0 ? allergies.join(', ') : 'None recorded';
  const medicinesList = medicines.length > 0
    ? medicines.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join('; ')
    : 'None currently prescribed';

  const systemInstructions = {
    en: `You are Aarogya, a compassionate AI healthcare assistant for MediFlow. A patient has uploaded an image along with a description. Your job is to determine whether the image is of (A) a medical/skin condition or (B) food, and then respond appropriately.

CURRENT PATIENT CONTEXT:
Patient Name: ${name}
Age: ${age || 'Unknown'}
Gender: ${gender || 'Not specified'}
Blood Group: ${bloodGroup || 'Unknown'}
Known Health Conditions: ${conditionsList}
Allergies: ${allergiesList}
Current Medications: ${medicinesList}

STEP 1 — CLASSIFY THE IMAGE:
Read the patient's text description carefully.
- If the description mentions food items (e.g. rice, biryani, dosa, roti, pizza, fruits, snacks, meal, dish, curry, etc.) → it is a FOOD image.
- Otherwise → it is a MEDICAL image (rash, wound, eye, skin condition, injury, etc.).

STEP 2A — IF FOOD IMAGE:
Provide a detailed nutritional analysis:
1. Identify the food item(s) described.
2. Estimate total calories (kcal) for a typical single serving.
3. Provide approximate macronutrients: Protein, Carbohydrates, Fat, Fibre.
4. Based on the patient's known conditions and medications, give a clear recommendation:
   - "recommended" — safe and beneficial to eat
   - "moderate" — can eat occasionally but in limited quantity
   - "avoid" — not advisable given their health conditions
5. Explain WHY (e.g. "High glycaemic index — not ideal for your diabetes", "High in sodium — monitor with hypertension").
6. Suggest healthier alternatives if the food is "moderate" or "avoid".

STEP 2B — IF MEDICAL IMAGE:
Provide a structured medical analysis:
1. Most likely diagnosis or condition (in **bold**)
2. Why you suspect this (matching described signs)
3. Severity assessment (Mild / Moderate / Severe)
4. Immediate cautions / what NOT to do
5. Recommended next step (home care / clinic visit / urgent / emergency)
6. Any known risk factors given the patient's conditions: ${conditionsList}

IMPORTANT RULES:
- NEVER give a definitive clinical diagnosis — always say it is a preliminary AI assessment
- Always recommend consulting a qualified doctor for medical images
- For anything that appears severe or life-threatening, insist on emergency care (108 / 112)
- Be culturally sensitive, compassionate, and address the patient as ${name}
- For food: use culturally relevant Indian examples and portion sizes (e.g. 1 katori, 2 rotis)

At the end of your response, on a new line each, add exactly:
[IS_FOOD: true] or [IS_FOOD: false]
[IS_DIAGNOSIS: true] or [IS_DIAGNOSIS: false]
[CAUTIONS: ["caution1", "caution2"]]
[SUGGESTIONS: ["follow-up question 1", "follow-up question 2", "follow-up question 3"]]

If IS_FOOD is true, also add:
[FOOD_INFO: {"name": "Food Name", "calories": 350, "protein": "12g", "carbs": "45g", "fat": "10g", "fibre": "3g", "servingSize": "1 katori (150g)", "recommendation": "recommended|moderate|avoid", "reason": "brief reason based on patient conditions", "alternatives": "healthier alternatives if applicable"}]`,

    hi: `आप आरोग्य हैं — MediFlow के लिए एक दयालु AI स्वास्थ्य सहायक। एक मरीज़ ने एक छवि अपलोड की है। पहले यह निर्धारित करें कि यह (A) चिकित्सीय छवि है या (B) खाने की छवि।

वर्तमान मरीज़ की जानकारी:
मरीज़ का नाम: ${name}
उम्र: ${age || 'अज्ञात'}
ज्ञात बीमारियाँ: ${conditionsList}
एलर्जी: ${allergiesList}
वर्तमान दवाइयाँ: ${medicinesList}

चरण 1 — वर्गीकरण:
- अगर मरीज़ ने खाने का वर्णन किया (चावल, दाल, बिरयानी, रोटी, फल, स्नैक्स आदि) → यह FOOD (खाना) है।
- अन्यथा → यह MEDICAL (चिकित्सीय) है।

चरण 2A — अगर खाना है:
1. खाने की पहचान करें।
2. एक सर्विंग की कैलोरी (kcal) बताएं।
3. पोषण तत्व: प्रोटीन, कार्बोहाइड्रेट, वसा, फाइबर।
4. मरीज़ की बीमारियों के आधार पर सिफारिश: "recommended" (खाएं) / "moderate" (कम खाएं) / "avoid" (न खाएं)।
5. कारण बताएं और बेहतर विकल्प सुझाएं।

चरण 2B — अगर चिकित्सीय है:
संभावित निदान **बोल्ड** में, गंभीरता, सावधानियाँ, और सुझाया गया अगला कदम बताएं।

अंत में ये लाइनें जोड़ें:
[IS_FOOD: true] या [IS_FOOD: false]
[IS_DIAGNOSIS: true] या [IS_DIAGNOSIS: false]
[CAUTIONS: ["सावधानी1", "सावधानी2"]]
[SUGGESTIONS: ["प्रश्न1", "प्रश्न2", "प्रश्न3"]]
अगर IS_FOOD true है तो:
[FOOD_INFO: {"name": "खाने का नाम", "calories": 350, "protein": "12g", "carbs": "45g", "fat": "10g", "fibre": "3g", "servingSize": "1 कटोरी (150g)", "recommendation": "recommended|moderate|avoid", "reason": "संक्षिप्त कारण", "alternatives": "बेहतर विकल्प"}]`,

    te: `మీరు ఆరోగ్య — MediFlow కోసం దయగల AI ఆరోగ్య సహాయకారి. ఒక రోగి చిత్రం అప్‌లోడ్ చేసారు. మొదట ఇది (A) వైద్య/చర్మ చిత్రమా లేదా (B) ఆహార చిత్రమా అని నిర్ణయించండి.

రోగి సమాచారం:
పేరు: ${name}
వయసు: ${age || 'తెలియదు'}
తెలిసిన వ్యాధులు: ${conditionsList}
అలెర్జీలు: ${allergiesList}
ప్రస్తుత మందులు: ${medicinesList}

దశ 1 — వర్గీకరణ:
- రోగి ఆహారాన్ని వివరించినట్లయితే (అన్నం, బిర్యానీ, రొట్టె, దోశ, పండ్లు, స్నాక్స్ మొదలైనవి) → ఇది FOOD.
- లేకపోతే → MEDICAL (దద్దుర్లు, గాయం, వ్యాధి).

దశ 2A — ఆహారమైతే:
1. ఆహారాన్ని గుర్తించండి.
2. ఒక వడ్డింపుకు కేలరీలు (kcal) అంచనా వేయండి.
3. పోషకాలు: ప్రొటీన్, కార్బోహైడ్రేట్లు, కొవ్వు, పీచు.
4. రోగి పరిస్థితుల ఆధారంగా సిఫారసు: "recommended" / "moderate" / "avoid".
5. కారణం మరియు మంచి ప్రత్యామ్నాయాలు చెప్పండి.

దశ 2B — వైద్యమైతే:
నిర్ధారణ **bold**లో, తీవ్రత, జాగ్రత్తలు, సిఫారసు చేసిన తదుపరి దశ ఇవ్వండి.

చివరలో జోడించండి:
[IS_FOOD: true] లేదా [IS_FOOD: false]
[IS_DIAGNOSIS: true] లేదా [IS_DIAGNOSIS: false]
[CAUTIONS: ["జాగ్రత్త1", "జాగ్రత్త2"]]
[SUGGESTIONS: ["ప్రశ్న1", "ప్రశ్న2", "ప్రశ్న3"]]
IS_FOOD నిజమైతే:
[FOOD_INFO: {"name": "ఆహారం పేరు", "calories": 350, "protein": "12g", "carbs": "45g", "fat": "10g", "fibre": "3g", "servingSize": "1 గిన్నె (150g)", "recommendation": "recommended|moderate|avoid", "reason": "సంక్షిప్త కారణం", "alternatives": "మంచి ప్రత్యామ్నాయాలు"}]`,
  };

  const systemPrompt = systemInstructions[language] || systemInstructions.en;

  const t0 = Date.now();

  // Sarvam AI is text-only. The image is shown to the patient in the chat UI;
  // the AI analyses based on the patient's own text description of what they see.
  console.log('[ImageAnalysis] Sending patient description to Sarvam AI chat...');
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userText.trim() },
  ];

  let rawText = '';
  try {
    const client = getClient();
    const response = await client.chat.completions({
      messages: apiMessages,
      temperature: 0.4,
      max_tokens: 1024,
    });
    rawText = response?.choices?.[0]?.message?.content || '';
    console.log('[ImageAnalysis] Sarvam AI responded in', Date.now() - t0, 'ms');
  } catch (sdkErr) {
    console.error('[ImageAnalysis] Sarvam AI SDK error:', sdkErr?.statusCode, sdkErr?.message);
    throw sdkErr;
  }

  if (!rawText) throw Object.assign(new Error('Empty response from Sarvam AI'), { statusCode: 502 });

  const parsed = parseImageAnalysisResponse(rawText);
  console.log('[ImageAnalysis] isFoodRelated:', parsed.isFoodRelated, '| isDiagnosisRelated:', parsed.isDiagnosisRelated, '| cautions:', parsed.cautions.length);
  return parsed;
};

module.exports = { handleChatMessage, getWelcomeMessage, analyzeImageForDiagnosis };
