import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle, X, Send, RefreshCw, Globe, Bot, User,
  AlertTriangle, Sparkles, ShieldAlert, Clock, Activity, Phone,
  ImagePlus, FlaskConical, Salad, CheckCircle2, AlertCircle, Ban,
  Flame, Beef, Wheat, Droplets,
} from "lucide-react";
import { patientApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Language = "en" | "hi" | "te";

export interface FoodInfo {
  name: string;
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  servingSize: string;
  recommendation: "recommended" | "moderate" | "avoid";
  reason: string;
  alternatives: string;
}

export interface RedFlagItem {
  condition: string;
  category: "life-threatening" | "time-sensitive" | "risk";
  action: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  redFlags?: RedFlagItem[];
  /** Data URL of an image sent by the user */
  imageUrl?: string;
  /** Original file name for display */
  imageFileName?: string;
  /** Caution strings from image diagnosis analysis */
  cautions?: string[];
  /** Whether the image was determined to be diagnosis-related */
  isDiagnosisRelated?: boolean;
  /** Whether the image was determined to be food-related */
  isFoodRelated?: boolean;
  /** Calorie and nutrition data returned when image is food-related */
  foodInfo?: FoodInfo | null;
}

interface HealthChatbotProps {
  /** Patient profile object to derive preferred language */
  patient?: any;
}

// ─── Language config ───────────────────────────────────────────────────────────
const LANG_CONFIG: Record<Language, { label: string; native: string; placeholder: string; sending: string; errorMsg: string; clearLabel: string; clearConfirm: string }> = {
  en: {
    label: "English",
    native: "EN",
    placeholder: "Ask about your health…",
    sending: "Thinking…",
    errorMsg: "Sorry, I couldn't get a response. Please try again.",
    clearLabel: "Clear chat",
    clearConfirm: "Clear conversation history?",
  },
  hi: {
    label: "हिन्दी",
    native: "हि",
    placeholder: "अपने स्वास्थ्य के बारे में पूछें…",
    sending: "सोच रहा हूँ…",
    errorMsg: "माफ़ करें, जवाब नहीं मिला। कृपया फिर से कोशिश करें।",
    clearLabel: "चैट साफ़ करें",
    clearConfirm: "बातचीत का इतिहास साफ़ करें?",
  },
  te: {
    label: "తెలుగు",
    native: "తె",
    placeholder: "మీ ఆరోగ్యం గురించి అడగండి…",
    sending: "ఆలోచిస్తున్నాను…",
    errorMsg: "క్షమించండి, స్పందన రాలేదు. మళ్లీ ప్రయత్నించండి.",
    clearLabel: "చాట్ క్లియర్ చేయండి",
    clearConfirm: "సంభాషణ చరిత్ర క్లియర్ చేయాలా?",
  },
};

// ─── Patient page route → label map ───────────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  "/dashboard/patient":                "Overview",
  "/dashboard/patient?tab=records":    "My Records",
  "/dashboard/patient?tab=medicines":  "Medicines",
  "/dashboard/patient?tab=labs":       "Lab Reports",
  "/dashboard/patient?tab=upload":     "Upload Documents",
  "/dashboard/patient?tab=qr":         "Emergency QR",
  "/dashboard/patient?tab=settings":   "Settings",
  "/reset-password":                   "Reset Password",
};

// ─── Red Flag Detection ────────────────────────────────────────────────────────
const RED_FLAG_PATTERNS: Array<{ keywords: string[]; flag: RedFlagItem }> = [
  // ── Life-threatening ──────────────────────────────────────────────────────
  {
    keywords: ["chest pain", "chest tightness", "chest pressure", "heart pain", "left arm pain", "jaw pain", "chest heaviness", "सीने में दर्द", "छाती में दर्द", "గుండె నొప్పి"],
    flag: { condition: "Possible Heart Attack (Acute MI)", category: "life-threatening", action: "Call 108 / 112 immediately. Chew aspirin (325 mg) if not allergic. Do not drive yourself." },
  },
  {
    keywords: ["face droop", "face drooping", "arm weakness", "sudden weakness", "slurred speech", "speech difficulty", "sudden numbness", "facial numbness", "sudden confusion", "stroke", "चेहरे की कमज़ोरी", "mukh"],
    flag: { condition: "Possible Stroke (FAST criteria)", category: "life-threatening", action: "Call 108 / 112. Note the time symptoms started. Every minute counts — clot-busting drugs must be given within 4.5 hours." },
  },
  {
    keywords: ["can't breathe", "cannot breathe", "difficulty breathing", "shortness of breath", "unable to breathe", "gasping", "choking", "breathless", "सांस नहीं आ रही", "శ్వాస తీసుకోలేకపోతున్నాను"],
    flag: { condition: "Severe Respiratory Distress / Possible Pulmonary Embolism", category: "life-threatening", action: "Call 108 / 112. Sit upright. Do not lie down. Loosen any tight clothing." },
  },
  {
    keywords: ["throat swelling", "tongue swelling", "lips swelling", "severe allergy", "anaphylaxis", "allergic reaction", "hives", "rash allergy", "sting allergy"],
    flag: { condition: "Possible Anaphylaxis (Severe Allergic Reaction)", category: "life-threatening", action: "Use EpiPen if available. Call 108 / 112. Lie down with legs raised unless breathing is difficult." },
  },
  {
    keywords: ["coughing blood", "vomiting blood", "blood in stool", "rectal bleeding", "blood from mouth", "hemoptysis", "खून की उल्टी", "రక్తం వమనం"],
    flag: { condition: "Possible Internal Bleeding / GI Bleed", category: "life-threatening", action: "Go to emergency immediately. Do not eat or drink. Keep the patient calm and still." },
  },
  {
    keywords: ["unconscious", "unresponsive", "passed out", "fainted", "not waking up", "collapsed", "बेहोश", "స్పృహ కోల్పోయారు"],
    flag: { condition: "Loss of Consciousness / Possible Cardiac Arrest", category: "life-threatening", action: "Call 108 / 112. Begin CPR if trained. Do not leave the person alone." },
  },
  {
    keywords: ["severe headache", "worst headache", "thunderclap headache", "sudden headache", "headache with stiff neck", "explosive headache", "बहुत तेज़ सिरदर्द", "తీవ్రమైన తలనొప్పి"],
    flag: { condition: "Possible Subarachnoid Hemorrhage / Brain Bleed", category: "life-threatening", action: "Go to emergency immediately. Avoid pain relievers like aspirin or ibuprofen until evaluated." },
  },
  // ── Time-sensitive interventions ──────────────────────────────────────────
  {
    keywords: ["sudden vision loss", "blurred vision", "double vision", "lost vision", "eye pain sudden", "अचानक दिखना बंद", "అకస్మాత్తుగా చూపు పోయింది"],
    flag: { condition: "Possible Retinal Artery Occlusion or Stroke", category: "time-sensitive", action: "Go to emergency within 1–2 hours. Vision loss due to retinal occlusion needs treatment within 90 minutes." },
  },
  {
    keywords: ["seizure", "convulsion", "fits", "epilepsy attack", "shaking uncontrollably", "दौरा", "మూర్ఛ"],
    flag: { condition: "Seizure / Convulsive Episode", category: "time-sensitive", action: "Do not restrain the person. Turn them on their side (recovery position). Call 108 if seizure lasts >5 min." },
  },
  {
    keywords: ["high fever", "fever 104", "fever 105", "fever 106", "fever 103", "stiff neck", "neck stiffness", "rash meningitis", "तेज बुखार", "అధిక జ్వరం"],
    flag: { condition: "Possible Meningitis / Severe Sepsis", category: "time-sensitive", action: "Go to emergency immediately. Meningitis can progress to death within 24 hours without antibiotics." },
  },
  {
    keywords: ["severe burn", "chemical burn", "electric shock", "electrical burn", "scalded", "जलना", "కాలింది"],
    flag: { condition: "Severe Burn Injury", category: "time-sensitive", action: "Cool burn with running water for 20 min. Do not apply ice, toothpaste, or butter. Go to emergency." },
  },
  {
    keywords: ["blood sugar low", "hypoglycemia", "sugar very low", "diabetic coma", "sweating shaking dizzy diabetic", "ब्लड शुगर कम", "రక్తంలో చక్కెర తక్కువ"],
    flag: { condition: "Severe Hypoglycemia (Diabetic Emergency)", category: "time-sensitive", action: "Give sugar immediately (juice, glucose tablets). If unconscious, call 108. Do not give food/drink to someone unconscious." },
  },
  // ── Risk stratification ───────────────────────────────────────────────────
  {
    keywords: ["crushing pain", "squeezing chest", "tearing pain", "radiating pain arm", "pain spreading to jaw", "तेज दबाव दर्द"],
    flag: { condition: "High Risk: Cardiac Event Pattern", category: "risk", action: "Do not ignore. Seek urgent evaluation even if past ECG was normal. Cardiac enzymes (Troponin) test needed." },
  },
  {
    keywords: ["shortness of breath at rest", "breathless lying down", "woke up breathless", "can't lie flat", "leg swelling breathless", "orthopnea"],
    flag: { condition: "High Risk: Possible Heart Failure / Fluid Overload", category: "risk", action: "Seek same-day urgent care. Sit upright. Restrict salt and fluid intake until evaluated." },
  },
  {
    keywords: ["pale", "cold sweat", "clammy skin", "cold and pale", "sweating and dizzy", "shock", "rapid heartbeat and dizzy"],
    flag: { condition: "Signs of Hemodynamic Shock / Circulatory Instability", category: "risk", action: "Lie down, raise legs if possible. Call 108 or go to emergency urgently." },
  },
];

const RED_FLAG_CATEGORY_LABELS: Record<RedFlagItem["category"], { label: string; icon: React.ReactNode; color: string }> = {
  "life-threatening": { label: "Life-Threatening", icon: <ShieldAlert className="w-3.5 h-3.5" />, color: "text-red-600" },
  "time-sensitive":   { label: "Time-Sensitive",   icon: <Clock className="w-3.5 h-3.5" />,      color: "text-orange-600" },
  "risk":             { label: "Risk Stratification", icon: <Activity className="w-3.5 h-3.5" />, color: "text-amber-600" },
};

const detectRedFlags = (text: string): RedFlagItem[] => {
  const lower = text.toLowerCase();
  const found: RedFlagItem[] = [];
  const seen = new Set<string>();
  for (const { keywords, flag } of RED_FLAG_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      if (!seen.has(flag.condition)) {
        seen.add(flag.condition);
        found.push(flag);
      }
    }
  }
  return found;
};

// ─── Red Flag Card component ────────────────────────────────────────────────
const RedFlagCard = ({ flags, language }: { flags: RedFlagItem[]; language: Language }) => {
  const grouped = {
    "life-threatening": flags.filter((f) => f.category === "life-threatening"),
    "time-sensitive":   flags.filter((f) => f.category === "time-sensitive"),
    "risk":             flags.filter((f) => f.category === "risk"),
  } as Record<RedFlagItem["category"], RedFlagItem[]>;

  const calmText = {
    en: "Please do NOT panic. These are potential severe conditions identified based on the symptoms you described. They are not a diagnosis, but they require prompt medical attention.",
    hi: "कृपया घबराएं नहीं। ये आपके लक्षणों के आधार पर पहचानी गई संभावित गंभीर स्थितियाँ हैं। ये निदान नहीं हैं, लेकिन इनमें तुरंत चिकित्सा ध्यान की आवश्यकता है।",
    te: "దయచేసి భయపడకండి. ఇవి మీరు వివరించిన లక్షణాల ఆధారంగా గుర్తించిన సాధ్యమయ్యే తీవ్రమైన పరిస్థితులు. ఇవి రోగ నిర్ధారణ కాదు, కానీ వీటికి తక్షణ వైద్య సహాయం అవసరం.",
  };

  return (
    <div className="mx-1 my-2 rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/30 overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide">
          {language === "hi" ? "⚠️ रेड फ्लैग चेतावनी" : language === "te" ? "⚠️ రెడ్ ఫ్లాగ్ హెచ్చరిక" : "⚠️ Red Flag Alert Detected"}
        </span>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        {/* Calm message */}
        <p className="text-[11px] text-red-700 dark:text-red-300 leading-snug font-medium border-b border-red-200 dark:border-red-800 pb-2">
          {calmText[language]}
        </p>

        {/* Grouped flags */}
        {(["life-threatening", "time-sensitive", "risk"] as RedFlagItem["category"][]).map((cat) => {
          const items = grouped[cat];
          if (!items.length) return null;
          const meta = RED_FLAG_CATEGORY_LABELS[cat];
          return (
            <div key={cat}>
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide mb-1 ${meta.color}`}>
                {meta.icon}
                {meta.label}
              </div>
              <div className="space-y-1.5">
                {items.map((f, i) => (
                  <div key={i} className="rounded-lg bg-white dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2.5 py-2">
                    <p className={`text-[11px] font-semibold ${meta.color} leading-tight`}>{f.condition}</p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{f.action}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Emergency call footer */}
        <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg px-2.5 py-1.5 mt-1">
          <Phone className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <p className="text-[10px] font-bold text-red-700 dark:text-red-300">
            {language === "hi" ? "आपातकालीन: 108 / 112 पर कॉल करें" : language === "te" ? "అత్యవసరం: 108 / 112 కి కాల్ చేయండి" : "Emergency: Call 108 / 112 immediately"}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Calorie Card component (food image analysis) ────────────────────────────
const CalorieCard = ({ foodInfo, language }: { foodInfo: FoodInfo; language: Language }) => {
  const recConfig: Record<FoodInfo["recommendation"], { label: { en: string; hi: string; te: string }; icon: React.ReactNode; color: string; border: string; bg: string }> = {
    recommended: {
      label: { en: "✅ Recommended for you", hi: "✅ आपके लिए उचित", te: "✅ మీకు సిఫారసు" },
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-green-700 dark:text-green-300",
      border: "border-green-400",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
    moderate: {
      label: { en: "⚠️ Eat in Moderation", hi: "⚠️ सीमित मात्रा में खाएं", te: "⚠️ తక్కువగా తినండి" },
      icon: <AlertCircle className="w-4 h-4" />,
      color: "text-amber-700 dark:text-amber-300",
      border: "border-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    avoid: {
      label: { en: "🚫 Avoid this food", hi: "🚫 इसे न खाएं", te: "🚫 దీన్ని తినవద్దు" },
      icon: <Ban className="w-4 h-4" />,
      color: "text-red-700 dark:text-red-300",
      border: "border-red-400",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
  };

  const rec = recConfig[foodInfo.recommendation] ?? recConfig.moderate;
  const headerLabel = {
    en: "🍽️ Calorie & Nutrition Check",
    hi: "🍽️ कैलोरी और पोषण जाँच",
    te: "🍽️ కేలరీ & పోషణ తనిఖీ",
  }[language];

  return (
    <div className={`mx-1 my-2 rounded-xl border-2 ${rec.border} ${rec.bg} overflow-hidden shadow-md`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white">
        <Salad className="w-4 h-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide">{headerLabel}</span>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        {/* Food name + calories */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-foreground">{foodInfo.name}</p>
            <p className="text-[11px] text-muted-foreground">{foodInfo.servingSize}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg px-2.5 py-1.5">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-orange-700 dark:text-orange-300">{foodInfo.calories} kcal</span>
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: language === "hi" ? "प्रोटीन" : language === "te" ? "ప్రొటీన్" : "Protein", value: foodInfo.protein, icon: <Beef className="w-3 h-3" />, color: "text-blue-600" },
            { label: language === "hi" ? "कार्बोहा." : language === "te" ? "కార్బ్స్" : "Carbs", value: foodInfo.carbs, icon: <Wheat className="w-3 h-3" />, color: "text-amber-600" },
            { label: language === "hi" ? "वसा" : language === "te" ? "కొవ్వు" : "Fat", value: foodInfo.fat, icon: <Droplets className="w-3 h-3" />, color: "text-purple-600" },
            { label: language === "hi" ? "फाइबर" : language === "te" ? "పీచు" : "Fibre", value: foodInfo.fibre, icon: <Salad className="w-3 h-3" />, color: "text-green-600" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 bg-white dark:bg-card border border-border rounded-lg px-1.5 py-1.5">
              <span className={color}>{icon}</span>
              <span className="text-[11px] font-semibold text-foreground">{value}</span>
              <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Recommendation */}
        <div className={`flex items-start gap-2 rounded-lg bg-white dark:bg-card border ${rec.border} px-2.5 py-2`}>
          <span className={rec.color}>{rec.icon}</span>
          <div className="flex-1">
            <p className={`text-[11px] font-bold ${rec.color}`}>{rec.label[language]}</p>
            <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{foodInfo.reason}</p>
          </div>
        </div>

        {/* Alternatives */}
        {foodInfo.alternatives && foodInfo.recommendation !== "recommended" && (
          <div className="bg-white dark:bg-card border border-border rounded-lg px-2.5 py-2">
            <p className="text-[10px] font-semibold text-foreground mb-0.5">
              {language === "hi" ? "बेहतर विकल्प:" : language === "te" ? "మంచి ప్రత్యామ్నాయాలు:" : "Healthier alternatives:"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug">{foodInfo.alternatives}</p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[9px] text-muted-foreground text-center border-t border-border pt-1.5">
          {language === "hi"
            ? "AI अनुमान। आहार परिवर्तन से पहले डॉक्टर/डाइटीशियन से मिलें।"
            : language === "te"
            ? "AI అంచనా. ఆహారం మార్చే ముందు వైద్యుడిని సంప్రదించండి."
            : "AI estimate only. Consult your doctor or dietitian before making dietary changes."}
        </p>
      </div>
    </div>
  );
};

// ─── Caution Card component (image analysis) ──────────────────────────────────
const CautionCard = ({ cautions, language }: { cautions: string[]; language: Language }) => {
  if (!cautions.length) return null;
  const headerText = {
    en: "⚠️ AI Cautions – Consult a Doctor",
    hi: "⚠️ AI सावधानियाँ – डॉक्टर से मिलें",
    te: "⚠️ AI జాగ్రత్తలు – డాక్టర్‌ని సంప్రదించండి",
  }[language];
  const disclaimerText = {
    en: "These are preliminary AI observations only. They are not a clinical diagnosis. Please consult a qualified doctor.",
    hi: "ये केवल प्रारंभिक AI अवलोकन हैं। ये कोई नैदानिक निदान नहीं है। कृपया एक योग्य डॉक्टर से परामर्श लें।",
    te: "ఇవి కేవలం ప్రారంభిక AI పరిశీలనలు మాత్రమే. ఇవి క్లినికల్ నిర్ధారణ కాదు. దయచేసి అర్హత పొందిన డాక్టర్‌ను సంప్రదించండి.",
  }[language];
  return (
    <div className="mx-1 my-2 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 overflow-hidden shadow-md">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white">
        <FlaskConical className="w-4 h-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide">{headerText}</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug font-medium border-b border-amber-200 dark:border-amber-800 pb-2">
          {disclaimerText}
        </p>
        <ul className="space-y-1.5">
          {cautions.map((c, i) => (
            <li key={i} className="flex items-start gap-2 bg-white dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-snug">{c}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5">
          <Phone className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
            {language === "hi" ? "किसी भी आपात स्थिति में: 108 / 112" : language === "te" ? "అత్యవసరంలో: 108 / 112" : "In any emergency: Call 108 / 112"}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Storage helpers ───────────────────────────────────────────────────────────
const STORAGE_KEY = "mediflow_chatbot_messages";

const loadMessages = (): ChatMessage[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ id: string; role: string; content: string; timestamp: string; redFlags?: RedFlagItem[] }>;
    return parsed.map((m) => ({ ...m, role: m.role as "user" | "assistant", timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
};

const saveMessages = (messages: ChatMessage[]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage might be full — ignore
  }
};

const msgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Markdown-lite renderer (bold + line breaks) ───────────────────────────────
const renderMarkdown = (text: string) => {
  // Split into lines, handle **bold** inline
  return text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>));
    return (
      <span key={i}>
        {rendered}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
};

// ─── Component ─────────────────────────────────────────────────────────────────
const HealthChatbot = ({ patient: _patient }: HealthChatbotProps) => {
  const { accessToken } = useAuth();
  // Always follow the app-wide language — no separate chatbot language key
  const { language, setLanguage: setAppLanguage } = useLanguage();

  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [navigateTo, setNavigateTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showLang, setShowLang] = useState(false);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(false);
  /** Pending image: selected but not yet sent — waits for user to add description */
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const langConfig = LANG_CONFIG[language];

  // Load persisted messages on mount
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length > 0) {
      setMessages(saved);
      setWelcomeLoaded(true);
    }
  }, []);

  // Fetch welcome message when first opened (if no history)
  useEffect(() => {
    if (!isOpen || welcomeLoaded || !accessToken) return;

    const fetchWelcome = async () => {
      try {
        const res = await patientApi.getChatbotWelcome(accessToken, language);
        const welcome: ChatMessage = {
          id: msgId(),
          role: "assistant",
          content: res.data.text,
          timestamp: new Date(),
        };
        setMessages([welcome]);
        setSuggestions(res.data.suggestions || []);
        setWelcomeLoaded(true);
      } catch {
        // Fallback welcome
        const fallback: ChatMessage = {
          id: msgId(),
          role: "assistant",
          content:
            language === "hi"
              ? "नमस्ते! मैं आरोग्य हूँ, आपका स्वास्थ्य सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?"
              : language === "te"
              ? "నమస్కారం! నేను ఆరోగ్య, మీ ఆరోగ్య సహాయకారిని. ఈరోజు నేను మీకు ఎలా సహాయపడగలను?"
              : "Hello! I'm Aarogya, your health assistant. How can I help you today?",
          timestamp: new Date(),
        };
        setMessages([fallback]);
        setSuggestions(
          language === "hi"
            ? ["मेरी बीमारियाँ समझाइए", "मुझे किस डॉक्टर को दिखाना चाहिए?", "दवाइयों के बारे में बताइए"]
            : language === "te"
            ? ["నా వ్యాధులు వివరించండి", "ఏ డాక్టర్‌ని చూడాలి?", "మందుల గురించి చెప్పండి"]
            : ["Explain my health conditions", "Which doctor should I see?", "Tell me about my medicines"]
        );
        setWelcomeLoaded(true);
      }
    };
    fetchWelcome();
  }, [isOpen, welcomeLoaded, accessToken, language]);

  // Auto-navigate when AI returns a relevant page route
  useEffect(() => {
    if (!navigateTo || !PAGE_LABELS[navigateTo]) return;
    const timer = setTimeout(() => {
      navigate(navigateTo);
      setNavigateTo(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [navigateTo, navigate]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Save messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) saveMessages(messages);
  }, [messages]);

  // Track unread count
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // When the app-level language changes, reset the chatbot so the welcome
  // message reloads in the new language
  const prevLangRef = useRef<Language>(language);
  useEffect(() => {
    if (prevLangRef.current !== language) {
      prevLangRef.current = language;
      setMessages([]);
      setSuggestions([]);
      setNavigateTo(null);
      setWelcomeLoaded(false);
      setError("");
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }, [language]);

  const handleSend = useCallback(
    async (text?: string) => {
      const rawContent = (text ?? input).trim();
      // Allow sending with no text if there is a pending image (Gemini Vision will analyse directly)
      const hasImage = !!pendingImage;
      if ((!rawContent && !hasImage) || isLoading || isImageLoading || !accessToken) return;

      // When sending an image with no user text, use a language-appropriate default question
      const defaultImageQuery = {
        en: "Analyse this image and give me health advice based on my records.",
        hi: "इस छवि का विश्लेषण करें और मेरे स्वास्थ्य रिकॉर्ड के अनुसार सलाह दें।",
        te: "ఈ చిత్రాన్ని విశ్లేషించి, నా ఆరోగ్య రికార్డుల ఆధారంగా సలహా ఇవ్వండి.",
      };
      const content = rawContent || (hasImage ? defaultImageQuery[language] : "");

      setInput("");
      setSuggestions([]);
      setNavigateTo(null);
      setError("");

      // ── Image path ────────────────────────────────────────────────────────
      if (pendingImage) {
        const { file, url } = pendingImage;
        setPendingImage(null);

        const userMsg: ChatMessage = {
          id: msgId(),
          role: "user",
          content,
          timestamp: new Date(),
          imageUrl: url,
          imageFileName: file.name,
        };
        setMessages((prev) => {
          const updated = [...prev, userMsg];
          saveMessages(updated);
          return updated;
        });
        setIsImageLoading(true);

        try {
          const res = await patientApi.analyzeChatbotImage(accessToken, file, content, language);
          const { isFoodRelated, isDiagnosisRelated, foodInfo, reply, cautions, suggestions: imgSuggestions } = res.data;

          const assistantMsg: ChatMessage = {
            id: msgId(),
            role: "assistant",
            content: reply,
            timestamp: new Date(),
            cautions: isDiagnosisRelated ? cautions : [],
            isDiagnosisRelated,
            isFoodRelated,
            foodInfo: isFoodRelated ? foodInfo : null,
          };
          setMessages((prev) => {
            const updated = [...prev, assistantMsg];
            saveMessages(updated);
            return updated;
          });
          setSuggestions(imgSuggestions || []);
          if (!isOpen) setUnreadCount((c) => c + 1);
        } catch {
          setError(langConfig.errorMsg);
        } finally {
          setIsImageLoading(false);
          setTimeout(() => inputRef.current?.focus(), 100);
        }
        return;
      }

      // ── Plain text path ────────────────────────────────────────────────────
      const detectedFlags = detectRedFlags(content);
      const userMsg: ChatMessage = {
        id: msgId(),
        role: "user",
        content,
        timestamp: new Date(),
        redFlags: detectedFlags.length > 0 ? detectedFlags : undefined,
      };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        saveMessages(updated);
        return updated;
      });
      setIsLoading(true);

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const res = await patientApi.sendChatMessage(accessToken, {
          messages: history,
          language,
        });

        const assistantMsg: ChatMessage = {
          id: msgId(),
          role: "assistant",
          content: res.data.reply,
          timestamp: new Date(),
        };

        setMessages((prev) => {
          const updated = [...prev, assistantMsg];
          saveMessages(updated);
          return updated;
        });
        setSuggestions(res.data.suggestions || []);
        setNavigateTo(res.data.navigateTo ?? null);

        if (!isOpen) setUnreadCount((c) => c + 1);
      } catch (err: any) {
        setError(err?.message === "AI service not configured. Please set GEMINI_API_KEY."
          ? "AI service is not configured. Please contact the administrator."
          : langConfig.errorMsg);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, isLoading, isImageLoading, accessToken, messages, language, langConfig, isOpen, pendingImage]
  );

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      // Revoke any previous pending image URL
      if (pendingImage) URL.revokeObjectURL(pendingImage.url);
      const url = URL.createObjectURL(file);
      setPendingImage({ file, url });
      // Focus the textarea so user can immediately type description
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [pendingImage]
  );

  const discardPendingImage = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage(null);
  }, [pendingImage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setAppLanguage(lang);
    setShowLang(false);
    // Reset chat so welcome + suggestions reload in the new language
    setMessages([]);
    setSuggestions([]);
    setNavigateTo(null);
    setWelcomeLoaded(false);
    setError("");
    if (pendingImage) { URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const clearChat = () => setShowClearModal(true);

  const confirmClearChat = () => {
    setMessages([]);
    setSuggestions([]);
    setNavigateTo(null);
    setWelcomeLoaded(false);
    setShowClearModal(false);
    if (pendingImage) { URL.revokeObjectURL(pendingImage.url); setPendingImage(null); }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open health assistant"
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 gradient-primary text-primary-foreground hover:scale-105 active:scale-95 ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <MessageCircle className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 right-0 z-50 flex flex-col bg-background border border-border shadow-2xl transition-all duration-300 ease-in-out
          ${isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-8 pointer-events-none"}
          w-full sm:w-[400px] sm:bottom-6 sm:right-6 sm:rounded-2xl
          h-[100dvh] sm:h-[600px] max-h-[100dvh] sm:max-h-[85vh]
        `}
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border gradient-primary text-primary-foreground rounded-t-none sm:rounded-t-2xl shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">
              {language === "hi" ? "आरोग्य – स्वास्थ्य सहायक" : language === "te" ? "ఆరోగ్య – ఆరోగ్య సహాయకారి" : "Aarogya – Health Assistant"}
            </p>
            <p className="text-[11px] opacity-80 truncate">
              {language === "hi" ? "MediFlow का AI स्वास्थ्य सहायक" : language === "te" ? "MediFlow AI ఆరోగ్య సహాయకారి" : "MediFlow AI Health Assistant"}
            </p>
          </div>

          {/* Language switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLang((v) => !v)}
              title="Change language"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/20 hover:bg-white/30 text-xs font-medium transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {langConfig.native}
            </button>
            {showLang && (
              <div className="absolute top-9 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-10 w-32">
                {(["en", "hi", "te"] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${language === lang ? "bg-primary/10 font-semibold text-primary" : "text-foreground"}`}
                  >
                    {LANG_CONFIG[lang].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear + Close */}
          <button
            onClick={clearChat}
            title={langConfig.clearLabel}
            className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors opacity-70 hover:opacity-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id}>
            <div
              className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                  msg.role === "assistant"
                    ? "gradient-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-3.5 h-3.5" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Image preview inside user bubble */}
                {msg.imageUrl && (
                  <div className="mb-1">
                    <img
                      src={msg.imageUrl}
                      alt={msg.imageFileName || "uploaded image"}
                      className="max-w-[220px] max-h-[160px] rounded-xl border border-border object-cover shadow-sm"
                    />
                    {msg.imageFileName && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 px-0.5 truncate max-w-[220px]">{msg.imageFileName}</p>
                    )}
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "assistant"
                      ? "bg-card border border-border text-foreground rounded-tl-sm"
                      : "gradient-primary text-primary-foreground rounded-tr-sm"
                  }`}
                >
                  {renderMarkdown(msg.content)}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
            {/* Red Flag Card */}
            {msg.redFlags && msg.redFlags.length > 0 && (
              <RedFlagCard flags={msg.redFlags} language={language} />
            )}
            {/* Caution Card for image diagnosis */}
            {msg.cautions && msg.cautions.length > 0 && (
              <CautionCard cautions={msg.cautions} language={language} />
            )}
            {/* Calorie Card for food image */}
            {msg.isFoodRelated && msg.foodInfo && (
              <CalorieCard foodInfo={msg.foodInfo} language={language} />
            )}
            </div>
          ))}

          {/* Image analysis loading indicator */}
          {isImageLoading && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="px-4 py-3 bg-card border border-border rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2">
                  <Salad className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <FlaskConical className="w-3.5 h-3.5 text-primary animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    {language === "hi" ? "छवि का विश्लेषण हो रहा है…" : language === "te" ? "చిత్రాన్ని విశ్లేషిస్తున్నాను…" : "Analysing image…"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="px-4 py-3 bg-card border border-border rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && !isImageLoading && (
            <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions */}
        {suggestions.length > 0 && !isLoading && (
          <div className="px-4 pb-2 shrink-0">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              {language === "hi" ? "सुझाए गए प्रश्न" : language === "te" ? "సూచించిన ప్రశ్నలు" : "Suggested questions"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50 text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-border px-4 py-3 shrink-0 bg-background sm:rounded-b-2xl">
          {/* Pending image preview strip */}
          {pendingImage && (
            <div className="relative inline-flex mb-2 group">
              <img
                src={pendingImage.url}
                alt="pending upload"
                className="h-16 w-16 rounded-lg object-cover border border-border shadow-sm"
              />
              <button
                onClick={discardPendingImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow hover:scale-110 transition-transform"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-lg px-1 py-0.5">
                <p className="text-[9px] text-white truncate">{pendingImage.file.name}</p>
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            {/* Hidden file input for image upload */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handleImageSelect}
            />
            {/* Image upload button */}
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading || isImageLoading}
              title={language === "hi" ? "छवि अपलोड करें (बीमारी या खाना)" : language === "te" ? "చిత్రం అప్‌లోడ్ చేయండి (వ్యాధి లేదా ఆహారం)" : "Upload image — food for calorie check or medical for diagnosis"}
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all shrink-0 ${
                pendingImage
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-primary hover:border-primary"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pendingImage
                  ? (language === "hi"
                      ? "वैकल्पिक: कुछ पूछें (जैसे: क्या मैं यह खा सकता हूँ?) या सीधे भेजें"
                      : language === "te"
                      ? "ఐచ్ఛికం: ఏదైనా అడగండి (నేను ఇది తినవచ్చా?) లేదా నేరుగా పంపండి"
                      : "Optional: ask a question (e.g. \"Can I eat this?\") or just press Send")
                  : langConfig.placeholder
              }
              rows={1}
              disabled={isLoading || isImageLoading}
              className="flex-1 resize-none bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-32 overflow-y-auto leading-relaxed"
              style={{ minHeight: "42px" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "42px";
                t.style.height = Math.min(t.scrollHeight, 128) + "px";
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage) || isLoading || isImageLoading}
              className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shrink-0"
            >
              {isLoading || isImageLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {language === "hi"
              ? "AI सहायक — संदेश भेजें या खाने/बीमारी की छवि अपलोड करें। गंभीर स्थिति में डॉक्टर से मिलें।"
              : language === "te"
              ? "AI సహాయకారి — సందేశం పంపండి లేదా ఆహారం/వ్యాధి చిత్రం అప్‌లోడ్ చేయండి."
              : "AI assistant — send text or upload a food image (calorie check) / medical image (diagnosis). Always consult a doctor."}
          </p>
        </div>
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Clear conversation modal */}
      <AlertDialog open={showClearModal} onOpenChange={setShowClearModal}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-destructive" />
              {language === "hi" ? "चैट साफ़ करें?"
                : language === "te" ? "చాట్ క్లియర్ చేయాలా?"
                : "Clear conversation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "hi"
                ? "यह क्रिया आपकी पूरी बातचीत का इतिहास हटा देगी। इसे वापस नहीं लाया जा सकता।"
                : language === "te"
                ? "ఈ చర్య మీ మొత్తం సంభాషణ చరిత్రను తొలగిస్తుంది. దీన్ని రద్దు చేయడం సాధ్యం కాదు."
                : "This will permanently delete your entire conversation history. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "hi" ? "रद्द करें" : language === "te" ? "రద్దు చేయండి" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "hi" ? "हाँ, साफ़ करें" : language === "te" ? "అవును, క్లియర్ చేయండి" : "Yes, clear chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default HealthChatbot;