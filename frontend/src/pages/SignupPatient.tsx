import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity, Plus, Trash2, ArrowLeft, ArrowRight, Check,
  Mic, MicOff, RotateCcw, Pencil, Globe,
} from "lucide-react";
import { authApi, RegisterPatientVoicePayload } from "@/lib/api";

// ─── Language config ───────────────────────────────────────────────────────────
type AppLanguage = "en" | "hi" | "te";

interface LangOption {
  code: AppLanguage;
  label: string;
  nativeLabel: string;
  sarvamCode: string;
  letter: string;
}

const LANG_OPTIONS: LangOption[] = [
  { code: "en", label: "English", nativeLabel: "English", sarvamCode: "en-IN", letter: "A"  },
  { code: "hi", label: "Hindi",   nativeLabel: "हिन्दी",   sarvamCode: "hi-IN", letter: "अ" },
  { code: "te", label: "Telugu",  nativeLabel: "తెలుగు",  sarvamCode: "te-IN", letter: "అ" },
];

// ─── Translations ──────────────────────────────────────────────────────────────
type Translations = {
  voiceSignup: string; formSignup: string;
  greetingSpeak: string; startBtn: string;
  nameQ: string; nameSpeak: string;
  phoneQ: string; phoneSpeak: string;
  dobQ: string; dobSpeak: string;
  genderQ: string; genderSpeak: string;
  reviewTitle: string; reviewSpeak: string;
  successSpeak: string;
  labelName: string; labelPhone: string; labelDob: string; labelGender: string;
  labelBlood: string; labelLangs: string;
  gMale: string; gFemale: string; gOther: string; gPrefer: string;
  tapSpeak: string; typeInstead: string; heard: string; editAnswer: string;
  reRecord: string; useThis: string; transcribing: string;
  micDenied: string; noRecording: string; invalidAnswer: string; transcribeFail: string;
  bloodGroup: string; langsKnown: string; back: string; createAccount: string; creating: string;
  accountCreated: string; welcomeMsg: string; yourPassword: string; saveWarning: string; goLogin: string;
  formStep0: string; formStep1: string; formStep2: string;
  formBasicTitle: string; formMedTitle: string; formReviewTitle: string;
  fName: string; fEmail: string; fPassword: string; fConfirmPwd: string;
  fPhone: string; fDob: string; fGender: string;
  fNext: string; fBack: string; fCreate: string; fCreating: string;
  fAgree: string; fTerms: string; fPrivacy: string; fAndWord: string;
  fEmergency: string; fAddContact: string;
  fContactName: string; fContactPhone: string; fContactRelation: string; fContactAddress: string;
  fAlreadyHave: string;
  errRequired: string; errMin8: string; errPwdMatch: string;
  errEmailFormat: string; errPhoneFormat: string;
  errEmailTaken: string; errPhoneTaken: string;
  alreadyAccount: string; logIn: string;
  emailLabel: string; emailPlaceholder: string; emailRequired: string;
  activationTitle: string; activationMsg: string; activateBtn: string;
  checkSpam: string;
};

const T: Record<AppLanguage, Translations> = {
  en: {
    voiceSignup: "Voice Signup", formSignup: "Form Signup",
    greetingSpeak: "Welcome to MediFlow! I'll help you create your patient account in just a few steps. Tap the button below to get started.",
    startBtn: "Start Voice Signup",
    nameQ: "What's your full name?", nameSpeak: "What is your full name?",
    phoneQ: "What's your mobile number?", phoneSpeak: "What is your 10-digit mobile number?",
    dobQ: "What's your date of birth? (e.g. 15 March 1990)", dobSpeak: "What is your date of birth? Please say the day, month, and year.",
    genderQ: "What's your gender?", genderSpeak: "What is your gender? You can say male, female, other, or prefer not to say.",
    reviewTitle: "Review your details", reviewSpeak: "Please review your information and add a few more details before we create your account.",
    successSpeak: "Your account has been created successfully. Please save your password.",
    labelName: "Full Name", labelPhone: "Phone", labelDob: "Date of Birth", labelGender: "Gender",
    labelBlood: "Blood Group", labelLangs: "Languages",
    gMale: "Male", gFemale: "Female", gOther: "Other", gPrefer: "Prefer not to say",
    tapSpeak: "Tap to Speak", typeInstead: "Type instead", heard: "Heard:", editAnswer: "Edit your answer:",
    reRecord: "Re-record", useThis: "Use This ✓", transcribing: "Transcribing your answer…",
    micDenied: "Microphone access denied. Please allow it in your browser settings.",
    noRecording: "Could not start recording. Please try again.",
    invalidAnswer: "Please provide a valid answer.", transcribeFail: "Transcription failed. Please re-record or type your answer.",
    bloodGroup: "Blood Group", langsKnown: "Languages Known", back: "Back",
    createAccount: "Create Account", creating: "Creating Account…",
    accountCreated: "Account Created!", welcomeMsg: "Save your auto-generated password below.",
    yourPassword: "Your Password", saveWarning: "Save this password — you won't be able to see it again.",
    goLogin: "Login to My Account",
    formStep0: "Basic Info", formStep1: "Medical Profile", formStep2: "Review & Confirm",
    formBasicTitle: "Basic Information", formMedTitle: "Medical Profile", formReviewTitle: "Review & Confirm",
    fName: "Full Name", fEmail: "Email", fPassword: "Password", fConfirmPwd: "Confirm Password",
    fPhone: "Phone Number", fDob: "Date of Birth", fGender: "Gender",
    fNext: "Next", fBack: "Back", fCreate: "Create Account", fCreating: "Creating…",
    fAgree: "I agree to the", fTerms: "Terms of Service", fPrivacy: "Privacy Policy", fAndWord: "and",
    fEmergency: "Emergency Contacts", fAddContact: "Add Emergency Contact",
    fContactName: "Name", fContactPhone: "Phone *", fContactRelation: "Relation", fContactAddress: "Address",
    fAlreadyHave: "Already have an account?",
    errRequired: "Required", errMin8: "Min 8 characters", errPwdMatch: "Passwords don't match",
    errEmailFormat: "Must be a valid @gmail.com address",
    errPhoneFormat: "Must be a 10-digit Indian mobile number starting with 6–9",
    errEmailTaken: "This email is already registered",
    errPhoneTaken: "This mobile number is already registered",
    alreadyAccount: "Already have an account?", logIn: "Log in",
    emailLabel: "Email Address", emailPlaceholder: "you@example.com", emailRequired: "Valid email required",
    activationTitle: "Verify and Activate Account",
    activationMsg: "Please follow the steps in the email to verify your account and set your password.",
    activateBtn: "Activate My Account",
    checkSpam: "Can't find it? Check your spam folder or request a new code.",
  },
  hi: {
    voiceSignup: "आवाज़ से साइनअप", formSignup: "फॉर्म से साइनअप",
    greetingSpeak: "MediFlow में आपका स्वागत है! मैं कुछ ही चरणों में आपका मरीज़ खाता बनाने में मदद करूँगा। शुरू करने के लिए नीचे दिए बटन को दबाएँ।",
    startBtn: "आवाज़ साइनअप शुरू करें",
    nameQ: "आपका पूरा नाम क्या है?", nameSpeak: "आपका पूरा नाम क्या है?",
    phoneQ: "आपका मोबाइल नंबर क्या है?", phoneSpeak: "अपना 10 अंकों का मोबाइल नंबर बताएं।",
    dobQ: "आपकी जन्म तिथि क्या है? (जैसे 15 मार्च 1990)", dobSpeak: "आपकी जन्म तिथि क्या है? कृपया दिन, महीना और साल बताएं।",
    genderQ: "आपका लिंग क्या है?", genderSpeak: "आपका लिंग क्या है? आप पुरुष, स्त्री, अन्य या बताना नहीं चाहते — कह सकते हैं।",
    reviewTitle: "अपनी जानकारी जांचें", reviewSpeak: "कृपया अपनी जानकारी जांचें और खाता बनाने से पहले कुछ और विवरण जोड़ें।",
    successSpeak: "आपका खाता सफलतापूर्वक बन गया। कृपया अपना पासवर्ड सुरक्षित रखें।",
    labelName: "पूरा नाम", labelPhone: "फ़ोन नंबर", labelDob: "जन्म तिथि", labelGender: "लिंग",
    labelBlood: "रक्त समूह", labelLangs: "भाषाएँ",
    gMale: "पुरुष", gFemale: "स्त्री", gOther: "अन्य", gPrefer: "बताना नहीं चाहते",
    tapSpeak: "बोलने के लिए दबाएँ", typeInstead: "टाइप करें", heard: "सुना गया:", editAnswer: "अपना उत्तर संपादित करें:",
    reRecord: "फिर से रिकॉर्ड करें", useThis: "यही उपयोग करें ✓", transcribing: "आपका उत्तर ट्रांसक्राइब हो रहा है…",
    micDenied: "माइक्रोफोन की अनुमति नहीं है। कृपया ब्राउज़र सेटिंग में अनुमति दें।",
    noRecording: "रिकॉर्डिंग शुरू नहीं हो सकी। कृपया पुनः प्रयास करें।",
    invalidAnswer: "कृपया एक वैध उत्तर दें।", transcribeFail: "ट्रांसक्रिप्शन विफल। कृपया फिर से रिकॉर्ड करें या टाइप करें।",
    bloodGroup: "रक्त समूह", langsKnown: "ज्ञात भाषाएँ", back: "वापस",
    createAccount: "खाता बनाएं", creating: "खाता बन रहा है…",
    accountCreated: "खाता बन गया!", welcomeMsg: "अपना स्वतः-जनित पासवर्ड नीचे सहेजें।",
    yourPassword: "आपका पासवर्ड", saveWarning: "यह पासवर्ड सहेजें — आप इसे दोबारा नहीं देख सकेंगे।",
    goLogin: "मेरे खाते में लॉगिन करें",
    formStep0: "बुनियादी जानकारी", formStep1: "चिकित्सा प्रोफाइल", formStep2: "समीक्षा और पुष्टि",
    formBasicTitle: "बुनियादी जानकारी", formMedTitle: "चिकित्सा प्रोफाइल", formReviewTitle: "समीक्षा और पुष्टि",
    fName: "पूरा नाम", fEmail: "ईमेल", fPassword: "पासवर्ड", fConfirmPwd: "पासवर्ड की पुष्टि",
    fPhone: "मोबाइल नंबर", fDob: "जन्म तिथि", fGender: "लिंग",
    fNext: "आगे", fBack: "वापस", fCreate: "खाता बनाएं", fCreating: "बन रहा है…",
    fAgree: "मैं इससे सहमत हूँ", fTerms: "सेवा की शर्तें", fPrivacy: "गोपनीयता नीति", fAndWord: "और",
    fEmergency: "आपातकालीन संपर्क", fAddContact: "संपर्क जोड़ें",
    fContactName: "नाम", fContactPhone: "फ़ोन *", fContactRelation: "संबंध", fContactAddress: "पता",
    fAlreadyHave: "पहले से खाता है?",
    errRequired: "आवश्यक है", errMin8: "कम से कम 8 अक्षर", errPwdMatch: "पासवर्ड मेल नहीं खाते",
    errEmailFormat: "वैध @gmail.com पता होना चाहिए",
    errPhoneFormat: "10 अंकों का मोबाइल नंबर होना चाहिए (6-9 से शुरू)",
    errEmailTaken: "यह ईमेल पहले से पंजीकृत है",
    errPhoneTaken: "यह मोबाइल नंबर पहले से पंजीकृत है",
    alreadyAccount: "पहले से खाता है?", logIn: "लॉगिन करें",
    emailLabel: "ईमेल पता", emailPlaceholder: "aap@example.com", emailRequired: "वैध ईमेल आवश्यक है",
    activationTitle: "अपना इनबॉक्स जांचें!",
    activationMsg: "हमने आपके ईमेल पर एक 6-अंकीय सक्रियता कोड भेजा है। अपना खाता सत्यापित करने और पासवर्ड सेट करने के लिए इसे दर्ज करें।",
    activateBtn: "खाता सक्रिय करें",
    checkSpam: "नहीं मिला? अपना स्पैम फ़ोल्डर जांचें या नया कोड मांगें।",
  },
  te: {
    voiceSignup: "వాయిస్ సైనప్", formSignup: "ఫారమ్ సైనప్",
    greetingSpeak: "MediFlow కి స్వాగతం! కొన్ని దశలలో మీ రోగి ఖాతాను సృష్టించడంలో నేను సహాయపడతాను. ప్రారంభించడానికి దిగువ బటన్ నొక్కండి.",
    startBtn: "వాయిస్ సైనప్ ప్రారంభించండి",
    nameQ: "మీ పూర్తి పేరు ఏమిటి?", nameSpeak: "మీ పూర్తి పేరు ఏమిటి?",
    phoneQ: "మీ మొబైల్ నంబర్ ఏమిటి?", phoneSpeak: "మీ 10 అంకెల మొబైల్ నంబర్ చెప్పండి.",
    dobQ: "మీ పుట్టిన తేదీ ఏమిటి? (ఉదా. 15 మార్చి 1990)", dobSpeak: "మీ పుట్టిన తేదీ ఏమిటి? దయచేసి రోజు, నెల మరియు సంవత్సరం చెప్పండి.",
    genderQ: "మీ లింగం ఏమిటి?", genderSpeak: "మీ లింగం ఏమిటి? మగ, ఆడ, ఇతర లేదా చెప్పడం ఇష్టం లేదు అని చెప్పవచ్చు.",
    reviewTitle: "మీ వివరాలు సమీక్షించండి", reviewSpeak: "దయచేసి మీ సమాచారాన్ని సమీక్షించి ఖాతా సృష్టించే ముందు కొన్ని వివరాలు జోడించండి.",
    successSpeak: "మీ ఖాతా విజయవంతంగా సృష్టించబడింది. దయచేసి మీ పాస్వర్డ్ సేవ్ చేయండి.",
    labelName: "పూర్తి పేరు", labelPhone: "ఫోన్", labelDob: "పుట్టిన తేదీ", labelGender: "లింగం",
    labelBlood: "రక్త సమూహం", labelLangs: "భాషలు",
    gMale: "మగ", gFemale: "ఆడ", gOther: "ఇతర", gPrefer: "చెప్పడం ఇష్టం లేదు",
    tapSpeak: "మాట్లాడటానికి నొక్కండి", typeInstead: "టైప్ చేయండి", heard: "వినబడింది:", editAnswer: "మీ సమాధానం సవరించండి:",
    reRecord: "మళ్ళీ రికార్డ్ చేయండి", useThis: "దీన్ని వాడండి ✓", transcribing: "మీ సమాధానాన్ని ట్రాన్స్క్రైబ్ చేస్తున్నాం…",
    micDenied: "మైక్రోఫోన్ అనుమతి లేదు. దయచేసి బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి.",
    noRecording: "రికార్డింగ్ ప్రారంభించలేకపోయాం. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    invalidAnswer: "దయచేసి సరైన సమాధానం ఇవ్వండి.", transcribeFail: "ట్రాన్స్క్రిప్షన్ విఫలమైంది. దయచేసి మళ్ళీ రికార్డ్ చేయండి లేదా టైప్ చేయండి.",
    bloodGroup: "రక్త సమూహం", langsKnown: "తెలిసిన భాషలు", back: "వెనక్కి",
    createAccount: "ఖాతా సృష్టించండి", creating: "ఖాతా సృష్టిస్తున్నాం…",
    accountCreated: "ఖాతా సృష్టించబడింది!", welcomeMsg: "మీ స్వయంచాలకంగా రూపొందించిన పాస్వర్డ్ దిగువన సేవ్ చేయండి.",
    yourPassword: "మీ పాస్వర్డ్", saveWarning: "ఈ పాస్వర్డ్ సేవ్ చేయండి — మీరు దీన్ని మళ్ళీ చూడలేరు.",
    goLogin: "నా ఖాతాలోకి లాగిన్ చేయండి",
    formStep0: "ప్రాథమిక సమాచారం", formStep1: "వైద్య ప్రొఫైల్", formStep2: "సమీక్ష & నిర్ధారణ",
    formBasicTitle: "ప్రాథమిక సమాచారం", formMedTitle: "వైద్య ప్రొఫైల్", formReviewTitle: "సమీక్ష & నిర్ధారణ",
    fName: "పూర్తి పేరు", fEmail: "ఇమెయిల్", fPassword: "పాస్వర్డ్", fConfirmPwd: "పాస్వర్డ్ నిర్ధారించండి",
    fPhone: "మొబైల్ నంబర్", fDob: "పుట్టిన తేదీ", fGender: "లింగం",
    fNext: "తదుపరి", fBack: "వెనక్కి", fCreate: "ఖాతా సృష్టించండి", fCreating: "సృష్టిస్తున్నాం…",
    fAgree: "నేను అంగీకరిస్తున్నాను", fTerms: "సేవా నిబంధనలు", fPrivacy: "గోప్యతా విధానం", fAndWord: "&",
    fEmergency: "అత్యవసర సంప్రదింపులు", fAddContact: "సంప్రదింపు జోడించండి",
    fContactName: "పేరు", fContactPhone: "ఫోన్ *", fContactRelation: "సంబంధం", fContactAddress: "చిరునామా",
    fAlreadyHave: "ఇప్పటికే ఖాతా ఉందా?",
    errRequired: "అవసరం", errMin8: "కనీసం 8 అక్షరాలు", errPwdMatch: "పాస్వర్డ్‌లు సరిపోలలేదు",
    errEmailFormat: "చెల్లుబాటు అయ్యే @gmail.com చిరునామా అవసరం",
    errPhoneFormat: "6-9 తో మొదలయ్యే 10 అంకెల మొబైల్ నంబర్ అవసరం",
    errEmailTaken: "ఈ ఇమెయిల్ ఇప్పటికే నమోదు అయింది",
    errPhoneTaken: "ఈ మొబైల్ నంబర్ ఇప్పటికే నమోదు అయింది",
    alreadyAccount: "ఇప్పటికే ఖాతా ఉందా?", logIn: "లాగిన్ చేయండి",
    emailLabel: "ఇమెయిల్ చిరునామా", emailPlaceholder: "meeru@example.com", emailRequired: "సరైన ఇమెయిల్ అవసరం",
    activationTitle: "మీ ఇన్‌బాక్స్ తనిఖీ చేయండి!",
    activationMsg: "మేము మీ ఇమెయిల్‌కు 6 అంకెల యాక్టివేషన్ కోడ్ పంపాము. మీ ఖాతాను ధృవీకరించి పాస్‌వర్డ్ సెట్ చేయడానికి దాన్ని నమోదు చేయండి.",
    activateBtn: "ఖాతా యాక్టివేట్ చేయండి",
    checkSpam: "కనపడలేదా? మీ స్పామ్ ఫోల్డర్ తనిఖీ చేయండి లేదా కొత్త కోడ్ అభ్యర్థించండి.",
  },
};

// ─── Constants ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu"];
const LANG_TO_LANGUAGE: Record<AppLanguage, string> = { en: "English", hi: "Hindi", te: "Telugu" };

// ─── Helpers ───────────────────────────────────────────────────────────────────
// Tracks the currently playing Sarvam TTS audio so it can be cancelled
let _sarvamAudio: HTMLAudioElement | null = null;
let _sarvamBlobUrl: string | null = null;

const cancelSpeech = () => {
  window.speechSynthesis?.cancel();
  if (_sarvamAudio) {
    _sarvamAudio.pause();
    _sarvamAudio.src = "";
    _sarvamAudio = null;
  }
  if (_sarvamBlobUrl) {
    URL.revokeObjectURL(_sarvamBlobUrl);
    _sarvamBlobUrl = null;
  }
};

const speakText = async (text: string, lang: AppLanguage) => {
  cancelSpeech();
  if (lang === "en") {
    // Browser TTS works well for English
    if (!("speechSynthesis" in window)) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.lang = "en-IN";
    window.speechSynthesis.speak(utt);
  } else {
    // Use Sarvam AI TTS for Hindi / Telugu (browser TTS lacks these voices)
    try {
      const langCode = lang === "hi" ? "hi-IN" : "te-IN";
      const res = await authApi.synthesizeSpeech(text, langCode);

      // Decode base64 → Blob → Object URL (more reliable than data URI for large WAV)
      const binaryStr = atob(res.data.audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      _sarvamBlobUrl = url;

      const audio = new Audio(url);
      _sarvamAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        _sarvamBlobUrl = null;
        _sarvamAudio = null;
      };
      await audio.play();
    } catch (err) {
      console.error("[TTS] Sarvam AI playback failed:", err);
      // Fallback: attempt browser TTS anyway
      if ("speechSynthesis" in window) {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.9;
        utt.lang = lang === "hi" ? "hi-IN" : "te-IN";
        window.speechSynthesis.speak(utt);
      }
    }
  }
};

const parseTranscript = (field: string | null, transcript: string): string => {
  if (!field) return transcript;
  switch (field) {
    case "phoneNumber":
      return transcript.replace(/\D/g, "").slice(-10);
    case "dob": {
      const MONTHS: Record<string, string> = {
        january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",
        july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
        jan:"01",feb:"02",mar:"03",apr:"04",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
        "जनवरी":"01","फरवरी":"02","मार्च":"03","अप्रैल":"04","मई":"05","जून":"06",
        "जुलाई":"07","अगस्त":"08","सितंबर":"09","अक्टूबर":"10","नवंबर":"11","दिसंबर":"12",
        "జనవరి":"01","ఫిబ్రవరి":"02","మార్చి":"03","ఏప్రిల్":"04","మే":"05","జూన్":"06",
        "జూలై":"07","ఆగస్టు":"08","సెప్టెంబర్":"09","అక్టోబర్":"10","నవంబర్":"11","డిసెంబర్":"12",
      };
      const lower = transcript.toLowerCase();
      const nums = transcript.match(/\d+/g) || [];
      for (const [name, monthNum] of Object.entries(MONTHS)) {
        if (lower.includes(name)) {
          let day = "", year = "";
          for (const n of nums) {
            if (n.length === 4) year = n;
            else if (parseInt(n) <= 31 && !day) day = n.padStart(2, "0");
          }
          if (day && year) return `${day}-${monthNum}-${year}`;
        }
      }
      const parts = transcript.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (parts) return `${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}-${parts[3]}`;
      try {
        const d = new Date(transcript);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          return `${dd}-${mm}-${yyyy}`;
        }
      } catch { /* fall through */ }
      return transcript;
    }
    case "gender": {
      const t2 = transcript.toLowerCase();
      if (t2.includes("female")||t2.includes("woman")||t2.includes("महिला")||t2.includes("स्त्री")||t2.includes("stree")||t2.includes("స్త్రీ")||t2.includes("ఆడ")) return "female";
      if (t2.includes("male")||t2.includes("man")||t2.includes("पुरुष")||t2.includes("purush")||t2.includes("మగ")) return "male";
      if (t2.includes("other")||t2.includes("अन्य")||t2.includes("ఇతర")) return "other";
      if (t2.includes("prefer")||t2.includes("not")||t2.includes("बताना")||t2.includes("ఇష్టం లేదు")) return "prefer_not_to_say";
      return transcript.trim();
    }
    default:
      return transcript.trim();
  }
};

const translateGender = (value: string, t: Translations): string => {
  const map: Record<string, string> = {
    male: t.gMale, female: t.gFemale, other: t.gOther, prefer_not_to_say: t.gPrefer,
  };
  return map[value] || value;
};

type RecordingStatus = "idle" | "recording" | "transcribing" | "confirming";

// ─── Language Selector ────────────────────────────────────────────────────────
const LanguageSelector = ({ onSelect }: { onSelect: (lang: AppLanguage) => void }) => (
  <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2 mb-8 justify-center">
        <Activity className="w-8 h-8 text-primary" />
        <span className="font-heading font-bold text-2xl gradient-text">MediFlow</span>
      </div>
      <div className="bg-card border border-border rounded-2xl p-8 shadow-card text-center">
        <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Globe className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-heading font-bold text-foreground mb-1">Choose your language</h2>
        <p className="text-sm text-muted-foreground mb-6">
          ఒక భాషను ఎంచుకోండి &nbsp;/&nbsp; अपनी भाषा चुनें &nbsp;/&nbsp; Select a language
        </p>
        <div className="flex flex-col gap-3">
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => onSelect(opt.code)}
              className="flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-border bg-background hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow text-primary-foreground font-bold text-lg flex-shrink-0">
                {opt.letter}
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.nativeLabel}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-medium">Log in</Link>
      </p>
    </div>
  </div>
);

// ─── Voice Signup Flow ────────────────────────────────────────────────────────
const VoiceSignupFlow = ({ lang, sarvamCode }: { lang: AppLanguage; sarvamCode: string }) => {
  const t = T[lang];
  const VOICE_STEPS = [
    { id: "greeting", field: null,          displayLabel: "",             question: "",              speak: t.greetingSpeak },
    { id: "name",     field: "name",         displayLabel: t.labelName,    question: t.nameQ,         speak: t.nameSpeak },
    { id: "phone",    field: "phoneNumber",  displayLabel: t.labelPhone,   question: t.phoneQ,        speak: t.phoneSpeak },
    { id: "dob",      field: "dob",          displayLabel: t.labelDob,     question: t.dobQ,          speak: t.dobSpeak },
    { id: "gender",   field: "gender",       displayLabel: t.labelGender,  question: t.genderQ,       speak: t.genderSpeak },
    { id: "review",   field: null,           displayLabel: "",             question: t.reviewTitle,   speak: t.reviewSpeak },
    { id: "success",  field: null,           displayLabel: "",             question: "",              speak: t.successSpeak },
  ] as const;

  const GENDER_OPTIONS = [
    { value: "male",              label: t.gMale },
    { value: "female",            label: t.gFemale },
    { value: "other",             label: t.gOther },
    { value: "prefer_not_to_say", label: t.gPrefer },
  ];

  const [stepIdx, setStepIdx]               = useState(0);
  const [recordStatus, setRecordStatus]     = useState<RecordingStatus>("idle");
  const [transcript, setTranscript]         = useState("");
  const [elapsedSecs, setElapsedSecs]       = useState(0);
  const [editMode, setEditMode]             = useState(false);
  const [editValue, setEditValue]           = useState("");
  const [apiError, setApiError]             = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [collected, setCollected]           = useState({ name: "", phoneNumber: "", dob: "", gender: "male" as string, email: "" });
  const [bloodGroup, setBloodGroup]         = useState<typeof BLOOD_GROUPS[number] | "">("");
  const [languages, setLanguages]           = useState<string[]>([LANG_TO_LANGUAGE[lang]]);
  const [history, setHistory]               = useState<{ q: string; a: string }[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyEndRef    = useRef<HTMLDivElement | null>(null);

  const step = VOICE_STEPS[stepIdx];

  useEffect(() => { if (step.speak) setTimeout(() => speakText(step.speak, lang), 300); }, [stepIdx]);
  useEffect(() => { historyEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);
  useEffect(() => () => { cancelSpeech(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const startRecording = async () => {
    setApiError(""); chunksRef.current = []; setTranscript(""); setEditMode(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((tk) => tk.stop());
        sendForTranscription(blob);
      };
      recorder.start(250);
      setRecordStatus("recording");
      setElapsedSecs(0);
      timerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    } catch (err: any) {
      setApiError(err?.message?.includes("Permission") ? t.micDenied : t.noRecording);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
    setRecordStatus("transcribing");
  };

  const sendForTranscription = async (blob: Blob) => {
    try {
      const ext = blob.type.includes("ogg") ? "audio.ogg" : "audio.wav";
      const res = await authApi.signupPatientVoice(blob, ext, sarvamCode);
      const raw = res.data.formatted_transcript || res.data.transcript || "";
      setTranscript(raw);
      setEditValue(parseTranscript(step.field, raw));
      setRecordStatus("confirming");
    } catch {
      setApiError(t.transcribeFail);
      setRecordStatus("idle");
    }
  };

  const useAnswer = () => {
    const value = editMode ? editValue : parseTranscript(step.field, transcript);
    if (!value.trim()) { setApiError(t.invalidAnswer); return; }
    setApiError("");
    setCollected((prev) => ({ ...prev, [step.field!]: value }));
    setHistory((h) => [...h, { q: step.question, a: value }]);
    setRecordStatus("idle"); setTranscript(""); setEditMode(false);
    setStepIdx((i) => i + 1);
  };

  const handleFormSubmit = async () => {
    if (!collected.email.trim() || !/\S+@\S+\.\S+/.test(collected.email)) {
      setApiError(t.emailRequired);
      return;
    }
    if (!bloodGroup) {
      setApiError(t.bloodGroup + " " + t.errRequired);
      return;
    }
    setSubmitting(true); setApiError("");
    try {
      const payload: RegisterPatientVoicePayload = {
        name: collected.name, email: collected.email, phoneNumber: collected.phoneNumber,
        dob: collected.dob, gender: collected.gender as RegisterPatientVoicePayload["gender"],
        bloodGroup: bloodGroup as any, languagesKnown: languages, preferredLanguage: lang,
      };
      await authApi.registerPatientVoice(payload);
      setStepIdx(6);
    } catch (err: any) {
      setApiError(err.message || "Registration failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  // GREETING
  if (stepIdx === 0) return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-lg">
        <Mic className="w-9 h-9 text-white" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-heading font-bold text-foreground">{t.voiceSignup}</h2>
        <p className="text-sm text-muted-foreground max-w-xs">{t.greetingSpeak}</p>
      </div>
      <button onClick={() => setStepIdx(1)} className="px-6 py-3 gradient-primary text-primary-foreground font-semibold rounded-lg shadow">
        {t.startBtn}
      </button>
    </div>
  );

  // ACTIVATION EMAIL SENT
  if (stepIdx === 6) return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Check className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-heading font-bold text-foreground mb-1">{t.activationTitle}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t.activationMsg}</p>
      </div>
      {collected.email && (
        <div className="bg-secondary rounded-lg px-4 py-2 text-sm font-medium text-foreground break-all">
          {collected.email}
        </div>
      )}
      <a
        href={`/reset-password?email=${encodeURIComponent(collected.email)}&lang=${lang}`}
        className="w-full py-3 gradient-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" /> {t.activateBtn}
      </a>
      <p className="text-xs text-muted-foreground">{t.checkSpam}</p>
    </div>
  );

  // REVIEW
  if (stepIdx === 5) return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-heading font-bold text-foreground">{t.reviewTitle}</h2>
      <div className="bg-secondary rounded-lg p-4 space-y-2 text-sm">
        {([["name", t.labelName], ["phoneNumber", t.labelPhone], ["dob", t.labelDob], ["gender", t.labelGender]] as [string, string][]).map(([field, label]) => (
          <div key={field} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground w-28 shrink-0">{label}</span>
            {field === "gender" ? (
              <select
                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                value={(collected as any)[field]}
                onChange={(e) => setCollected((c) => ({ ...c, [field]: e.target.value }))}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                value={(collected as any)[field]}
                onChange={(e) => setCollected((c) => ({ ...c, [field]: e.target.value }))}
              />
            )}
          </div>
        ))}
        {/* Email — typed input, not voice-collected */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border mt-1">
          <span className="text-muted-foreground w-28 shrink-0 font-medium">{t.emailLabel} *</span>
          <input
            type="email"
            className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={collected.email}
            onChange={(e) => setCollected((c) => ({ ...c, email: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{t.bloodGroup}</label>
        <div className="flex flex-wrap gap-2">
          {BLOOD_GROUPS.map((bg) => (
            <button key={bg} type="button" onClick={() => setBloodGroup(bg)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${bg === bloodGroup ? "gradient-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground border-border"}`}>
              {bg}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{t.langsKnown}</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((lng) => {
            const isInitial = lng === LANG_TO_LANGUAGE[lang];
            return (
              <button key={lng} type="button"
                disabled={isInitial}
                onClick={() => { if (!isInitial) setLanguages((prev) => prev.includes(lng) ? prev.filter((l) => l !== lng) : [...prev, lng]); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${languages.includes(lng) ? "gradient-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground border-border"} ${isInitial ? "opacity-80 cursor-not-allowed" : ""}`}>
                {lng}{isInitial ? " \uD83D\uDD12" : ""}
              </button>
            );
          })}
        </div>
      </div>
      {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{apiError}</p>}
      <div className="flex gap-3 mt-2">
        <button onClick={() => setStepIdx(4)} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary border border-primary rounded-md">
          <ArrowLeft className="w-4 h-4" /> {t.back}
        </button>
        <button disabled={submitting} onClick={handleFormSubmit} className="flex-1 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50">
          {submitting ? t.creating : t.createAccount}
        </button>
      </div>
    </div>
  );

  // CONVERSATION STEPS 1–4
  return (
    <div className="flex flex-col gap-4">
      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`rounded-full transition-all duration-300 ${i + 1 < stepIdx ? "w-2 h-2 bg-primary" : i + 1 === stepIdx ? "w-3 h-3 gradient-primary" : "w-2 h-2 bg-muted"}`} />
        ))}
      </div>

      {/* Conversation history */}
      {history.length > 0 && (
        <div className="max-h-36 overflow-y-auto space-y-2 px-1">
          {history.map((h, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded-2xl rounded-tl-sm max-w-[80%]">{h.q}</div>
              </div>
              <div className="flex justify-end">
                <div className="gradient-primary text-primary-foreground text-xs px-3 py-1.5 rounded-2xl rounded-tr-sm max-w-[80%]">{h.a}</div>
              </div>
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
      )}

      {/* Assistant question bubble */}
      <div className="flex justify-start">
        <div className="bg-card border border-border shadow-sm text-foreground text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
          <span className="font-semibold text-primary text-xs block mb-1">MediFlow Assistant</span>
          {step.question}
        </div>
      </div>

      {/* Recording / confirming area */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">

        {recordStatus === "idle" && (
          <>
            <button onClick={startRecording} className="w-full flex items-center justify-center gap-2 gradient-primary text-primary-foreground py-3 rounded-lg text-sm font-medium">
              <Mic className="w-4 h-4" /> {t.tapSpeak}
            </button>
            <button onClick={() => { setEditMode(true); setEditValue(""); setRecordStatus("confirming"); }} className="w-full text-xs text-muted-foreground underline underline-offset-2 text-center py-1">
              {t.typeInstead}
            </button>
          </>
        )}

        {recordStatus === "recording" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
              <MicOff className="w-8 h-8 text-red-500" />
              <span className="absolute inset-0 rounded-full bg-red-300 opacity-40 animate-ping" />
            </div>
            <span className="font-mono text-lg font-bold text-red-500">{fmt(elapsedSecs)}</span>
            <button onClick={stopRecording} className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg">Stop Recording</button>
          </div>
        )}

        {recordStatus === "transcribing" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-muted-foreground">{t.transcribing}</p>
          </div>
        )}

        {recordStatus === "confirming" && (
          <>
            {!editMode && transcript && (
              <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-foreground">
                <span className="text-xs text-muted-foreground block mb-0.5">{t.heard}</span>
                {transcript}
              </div>
            )}
            {editMode && (
              <div>
                <span className="text-xs text-muted-foreground block mb-1">{t.editAnswer}</span>
                {step.field === "gender" ? (
                  <div className="flex flex-wrap gap-2">
                    {GENDER_OPTIONS.map((g) => (
                      <button key={g.value} type="button" onClick={() => setEditValue(g.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border ${editValue === g.value ? "gradient-primary text-primary-foreground border-transparent" : "bg-background border-border text-muted-foreground"}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                ) : step.field === "dob" ? (
                  <input type="date" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background" />
                ) : (
                  <input autoFocus className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setTranscript(""); setEditMode(false); setRecordStatus("idle"); }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-muted text-muted-foreground rounded-lg" title={t.reRecord}>
                <RotateCcw className="w-4 h-4" />
              </button>
              {!editMode && (
                <button onClick={() => { setEditMode(true); setEditValue(parseTranscript(step.field, transcript)); }}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-muted text-muted-foreground rounded-lg" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              <button onClick={useAnswer} className="flex-1 py-2.5 text-sm font-semibold gradient-primary text-primary-foreground rounded-lg">
                {t.useThis}
              </button>
            </div>
          </>
        )}
      </div>

      {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{apiError}</p>}
    </div>
  );
};

// ─── Form Signup Flow ─────────────────────────────────────────────────────────
const FormSignupFlow = ({ lang }: { lang: AppLanguage }) => {
  const t = T[lang];
  const FORM_STEPS = [t.formStep0, t.formStep1, t.formStep2];

  const [step, setStep]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState("");
  const [done, setDone]         = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const [form, setForm] = useState({
    name: "", email: "", phoneNumber: "", dob: "",
    gender: "male" as "male" | "female" | "other" | "prefer_not_to_say",
    bloodGroup: "" as typeof BLOOD_GROUPS[number] | "",
    languages: [LANG_TO_LANGUAGE[lang]] as string[],
    emergencyContacts: [{ name: "", phoneNumber: "", address: "", relation: "" }],
    agreed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: any) => {
    setForm((p) => ({ ...p, [field]: value }));
    // Clear the error for this field as soon as the user starts re-typing
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };
  const initialLang = LANG_TO_LANGUAGE[lang];
  const toggleLang = (lng: string) => {
    if (lng === initialLang) return; // initial language is locked
    setForm((p) => ({
      ...p, languages: p.languages.includes(lng) ? p.languages.filter((l) => l !== lng) : [...p.languages, lng],
    }));
  };
  const addContact    = () => { if (form.emergencyContacts.length < 3) setForm((p) => ({ ...p, emergencyContacts: [...p.emergencyContacts, { name: "", phoneNumber: "", address: "", relation: "" }] })); };
  const removeContact = (i: number) => setForm((p) => ({ ...p, emergencyContacts: p.emergencyContacts.filter((_, idx) => idx !== i) }));
  const updateContact = (i: number, field: string, value: string) => setForm((p) => { const c = [...p.emergencyContacts]; c[i] = { ...c[i], [field]: value }; return { ...p, emergencyContacts: c }; });

  const PHONE_RE = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
  const EMAIL_RE = /^[a-z0-9](\.?[a-z0-9]){5,29}(\+[a-z0-9]+)?@gmail\.com$/;

  /** Today's date as YYYY-MM-DD for max="" on date inputs */
  const todayStr = new Date().toISOString().split("T")[0];

  /** Run format check + server uniqueness check when user leaves the field. */
  const validateOnBlur = async (field: "email" | "phoneNumber") => {
    if (field === "email") {
      const v = form.email.trim().toLowerCase();
      if (!v) { setErrors((p) => ({ ...p, email: t.errRequired })); return; }
      if (!EMAIL_RE.test(v)) { setErrors((p) => ({ ...p, email: t.errEmailFormat })); return; }
      try {
        const res = await authApi.checkAvailability({ email: v });
        if (res.data.emailTaken) setErrors((p) => ({ ...p, email: t.errEmailTaken }));
      } catch { /* skip uniqueness check silently on network error */ }
    } else {
      const v = form.phoneNumber.trim();
      if (!v) { setErrors((p) => ({ ...p, phoneNumber: t.errRequired })); return; }
      if (!PHONE_RE.test(v)) { setErrors((p) => ({ ...p, phoneNumber: t.errPhoneFormat })); return; }
      try {
        const res = await authApi.checkAvailability({ phoneNumber: v });
        if (res.data.phoneTaken) setErrors((p) => ({ ...p, phoneNumber: t.errPhoneTaken }));
      } catch { /* skip uniqueness check silently on network error */ }
    }
  };

  const validateStep = () => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!form.bloodGroup) errs.bloodGroup = t.errRequired;
    }
    if (step === 0) {
      if (!form.name.trim()) {
        errs.name = t.errRequired;
      }
      if (!form.email.trim()) {
        errs.email = t.errRequired;
      } else if (!EMAIL_RE.test(form.email.trim().toLowerCase())) {
        errs.email = t.errEmailFormat;
      }
      if (!form.phoneNumber.trim()) {
        errs.phoneNumber = t.errRequired;
      } else if (!PHONE_RE.test(form.phoneNumber.trim())) {
        errs.phoneNumber = t.errPhoneFormat;
      }
      if (!form.dob) errs.dob = t.errRequired;
      else if (new Date(form.dob) > new Date()) errs.dob = "Date of birth cannot be in the future";
    }
    // Also block if async errors (email taken / phone taken) are still present
    if (errors.email) errs.email = errors.email;
    if (errors.phoneNumber) errs.phoneNumber = errors.phoneNumber;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!form.agreed) return;
    if (!form.bloodGroup) { setApiError(t.bloodGroup + ": " + t.errRequired); return; }
    setLoading(true); setApiError("");
    try {
      const [y, m, d] = (form.dob || "").split("-");
      const apiDob = d && m && y ? `${d}-${m}-${y}` : form.dob;
      await authApi.registerPatient({
        name: form.name, email: form.email,
        gender: form.gender, bloodGroup: form.bloodGroup as any,
        phoneNumber: form.phoneNumber, dob: apiDob,
        languagesKnown: form.languages,
        preferredLanguage: lang,
        emergencyContacts: form.emergencyContacts
          .filter((c) => c.phoneNumber)
          .map(({ name, phoneNumber, address, relation }) => ({ name, phoneNumber, address, relation })),
      });
      setRegisteredEmail(form.email);
      setDone(true);
    } catch (err: any) {
      setApiError(err.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const ic = (field: string) =>
    `w-full px-3 py-2.5 border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${errors[field] ? "border-destructive" : "border-input"}`;

  return (
    <>
      {/* ── Activation sent screen ── */}
      {done && (
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-1">{t.activationTitle}</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t.activationMsg}</p>
          </div>
          {registeredEmail && (
            <div className="bg-secondary rounded-lg px-4 py-2 text-sm font-medium text-foreground break-all">
              {registeredEmail}
            </div>
          )}
          <a
            href={`/reset-password?email=${encodeURIComponent(registeredEmail)}&lang=${lang}`}
            className="w-full py-3 gradient-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> {t.activateBtn}
          </a>
          <p className="text-xs text-muted-foreground">{t.checkSpam}</p>
        </div>
      )}

      {!done && (
      <>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {FORM_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= step ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">{s}</span>
            {i < FORM_STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {step === 0 && (
          <>
            <h2 className="text-lg font-heading font-bold text-foreground mb-4">{t.formBasicTitle}</h2>
            <div>
              <label className="block text-sm font-medium mb-1">{t.fName}</label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={() => { if (!form.name.trim()) setErrors((p) => ({ ...p, name: t.errRequired })); }}
                className={ic("name")}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.fEmail}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                onBlur={() => validateOnBlur("email")}
                className={ic("email")}
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.fPhone}</label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => updateField("phoneNumber", e.target.value)}
                onBlur={() => validateOnBlur("phoneNumber")}
                className={ic("phoneNumber")}
              />
              {errors.phoneNumber && <p className="text-xs text-destructive mt-1">{errors.phoneNumber}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t.fDob}</label>
                <input
                  type="date"
                  value={form.dob}
                  max={todayStr}
                  onChange={(e) => updateField("dob", e.target.value)}
                  onBlur={() => {
                    if (!form.dob) setErrors((p) => ({ ...p, dob: t.errRequired }));
                    else if (new Date(form.dob) > new Date()) setErrors((p) => ({ ...p, dob: "Date of birth cannot be in the future" }));
                  }}
                  className={ic("dob")}
                />
                {errors.dob && <p className="text-xs text-destructive mt-1">{errors.dob}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.fGender}</label>
                <select value={form.gender} onChange={(e) => updateField("gender", e.target.value)} className={ic("gender")}>
                  <option value="male">{t.gMale}</option>
                  <option value="female">{t.gFemale}</option>
                  <option value="other">{t.gOther}</option>
                  <option value="prefer_not_to_say">{t.gPrefer}</option>
                </select>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-lg font-heading font-bold text-foreground mb-4">{t.formMedTitle}</h2>
            <div>
              <label className="block text-sm font-medium mb-1">{t.bloodGroup}</label>
              <select value={form.bloodGroup} onChange={(e) => updateField("bloodGroup", e.target.value)} className={ic("bloodGroup")}>
                <option value="" disabled>{t.bloodGroup}…</option>
                {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
              </select>
              {errors.bloodGroup && <p className="text-xs text-destructive mt-1">{errors.bloodGroup}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.langsKnown}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LANGUAGE_OPTIONS.map((lng) => {
                  const isInitial = lng === initialLang;
                  return (
                    <button key={lng} type="button" disabled={isInitial} onClick={() => toggleLang(lng)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${form.languages.includes(lng) ? "gradient-primary text-primary-foreground border-transparent" : "bg-background text-muted-foreground border-border"} ${isInitial ? "opacity-80 cursor-not-allowed" : ""}`}>
                      {lng}{isInitial ? " \uD83D\uDD12" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-3">{t.fEmergency}</label>
              {form.emergencyContacts.map((c, i) => (
                <div key={i} className="border border-border rounded-md p-3 mb-3 bg-secondary">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Contact {i + 1}</span>
                    {form.emergencyContacts.length > 1 && (
                      <button type="button" onClick={() => removeContact(i)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder={t.fContactName} value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} className={ic("")} />
                    <input placeholder={t.fContactPhone} value={c.phoneNumber} onChange={(e) => updateContact(i, "phoneNumber", e.target.value)} className={ic("")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input placeholder={t.fContactRelation} value={c.relation} onChange={(e) => updateContact(i, "relation", e.target.value)} className={ic("")} />
                    <input placeholder={t.fContactAddress} value={c.address} onChange={(e) => updateContact(i, "address", e.target.value)} className={ic("")} />
                  </div>
                </div>
              ))}
              {form.emergencyContacts.length < 3 && (
                <button type="button" onClick={addContact} className="flex items-center gap-1.5 text-sm text-primary font-medium">
                  <Plus className="w-4 h-4" /> {t.fAddContact}
                </button>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-heading font-bold text-foreground mb-4">{t.formReviewTitle}</h2>
            <div className="bg-secondary rounded-md p-4 space-y-2 text-sm">
              {([[t.fName, form.name], [t.fEmail, form.email], [t.fPhone, form.phoneNumber], [t.fDob, (() => { const [fy, fm, fd] = (form.dob || "").split("-"); return fd && fm && fy ? `${fd}-${fm}-${fy}` : form.dob || "—"; })()], [t.fGender, translateGender(form.gender, t)], [t.bloodGroup, form.bloodGroup], [t.langsKnown, form.languages.join(", ")]] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground">{v || "—"}</span>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.agreed} onChange={(e) => updateField("agreed", e.target.checked)} className="accent-primary mt-0.5" />
              <span>{t.fAgree} <a href="#" className="text-primary">{t.fTerms}</a> {t.fAndWord} <a href="#" className="text-primary">{t.fPrivacy}</a></span>
            </label>
            {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{apiError}</p>}
          </>
        )}
      </div>

      <div className="flex justify-between mt-6">
        {step > 0
          ? <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary border border-primary rounded-md"><ArrowLeft className="w-4 h-4" /> {t.fBack}</button>
          : <Link to="/login" className="text-sm text-muted-foreground self-center">{t.fAlreadyHave}</Link>}
        {step < 2
          ? <button onClick={() => { if (validateStep()) setStep((s) => s + 1); }} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md">{t.fNext} <ArrowRight className="w-4 h-4" /></button>
          : <button disabled={!form.agreed || loading} onClick={handleSubmit} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50">{loading ? t.fCreating : t.fCreate}</button>}
      </div>
      </>
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
type SignupMode = "voice" | "form";

const SignupPatient = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<SignupMode>("voice");

  const langParam = searchParams.get("lang");
  const selectedLang: AppLanguage | null = LANG_OPTIONS.some((o) => o.code === langParam)
    ? (langParam as AppLanguage)
    : null;

  if (!selectedLang) {
    return <LanguageSelector onSelect={(code) => navigate(`/signup/patient?lang=${code}`)} />;
  }

  const langOption = LANG_OPTIONS.find((o) => o.code === selectedLang)!;
  const t = T[selectedLang];

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header with language switcher */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" />
            <span className="font-heading font-bold text-xl gradient-text">MediFlow</span>
          </div>
          <button
            onClick={() => navigate("/signup/patient")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            <Globe className="w-3.5 h-3.5" /> {langOption.nativeLabel}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-muted rounded-xl p-1 mb-6">
          <button onClick={() => setMode("voice")} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "voice" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}>
            <Mic className="w-4 h-4" /> {t.voiceSignup}
          </button>
          <button onClick={() => setMode("form")} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "form" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}>
            <Pencil className="w-4 h-4" /> {t.formSignup}
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          {mode === "voice"
            ? <VoiceSignupFlow lang={selectedLang} sarvamCode={langOption.sarvamCode} />
            : <FormSignupFlow lang={selectedLang} />}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {t.alreadyAccount}{" "}
          <Link to="/login" className="text-primary font-medium">{t.logIn}</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPatient;
