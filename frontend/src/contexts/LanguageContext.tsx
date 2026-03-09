import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type AppLanguage = "en" | "hi" | "te";

export const LANG_KEY = "mediflow_ui_language";

// ─── Translation schema ────────────────────────────────────────────────────────
export interface Translations {
  // Common
  loading: string;
  save: string;
  cancel: string;
  back: string;
  next: string;
  submit: string;
  search: string;
  close: string;
  yes: string;
  no: string;
  add: string;
  edit: string;
  delete: string;
  refresh: string;
  download: string;
  upload: string;
  view: string;
  confirm: string;
  errorOccurred: string;
  noData: string;
  actions: string;
  status: string;
  details: string;
  settings: string;
  profile: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  address: string;
  languages: string;
  date: string;
  time: string;
  // Navbar
  navLogin: string;
  navGetStarted: string;
  // Landing
  landingBadge: string;
  landingHero: string;
  landingHeroHighlight: string;
  landingSubtitle: string;
  landingStartFree: string;
  landingHipaa: string;
  landingBuiltForIndia: string;
  landingRealTimeAI: string;
  landingSoapAuto: string;
  landingFeaturesTitle: string;
  landingFeature1Title: string;
  landingFeature1Items: string[];
  landingFeature2Title: string;
  landingFeature2Items: string[];
  landingFeature3Title: string;
  landingFeature3Items: string[];
  landingHowTitle: string;
  landingStep1: string;
  landingStep2: string;
  landingStep3: string;
  landingStep4: string;
  landingForDoctors: string;
  landingDoctorCta: string;
  landingDoctorBenefits: string[];
  landingForPatients: string;
  landingPatientCta: string;
  landingPatientBenefits: string[];
  landingQrTitle: string;
  landingQrDesc: string;
  landingQrCta: string;
  landingEmergencyCard: string;
  // Login
  loginWelcome: string;
  loginSubtitle: string;
  loginTagline: string;
  loginEmailPhone: string;
  loginPassword: string;
  loginBtn: string;
  loginLoading: string;
  loginForgot: string;
  loginNoAccount: string;
  loginSignUp: string;
  loginDoctorPharmacist: string;
  loginUnverifiedTitle: string;
  loginUnverifiedMsg: string;
  loginActivate: string;
  // Footer
  footerTagline: string;
  footerProduct: string;
  footerFeatures: string;
  footerHowItWorks: string;
  footerPricing: string;
  footerApi: string;
  footerCompany: string;
  footerAbout: string;
  footerCareers: string;
  footerBlog: string;
  footerPress: string;
  footerContact: string;
  footerCopyright: string;
  // NotFound
  notFoundTitle: string;
  notFoundMsg: string;
  notFoundHome: string;
  // Unauthorized
  unauthorizedTitle: string;
  unauthorizedMsg: string;
  unauthorizedHome: string;
  // Sidebar / Logout
  sidebarLogout: string;
  sidebarLogoutConfirm: string;
  sidebarLogoutCancel: string;
  sidebarLogoutBtn: string;
  // Patient sidebar
  patientOverview: string;
  patientRecords: string;
  patientMedicines: string;
  patientLabs: string;
  patientUpload: string;
  patientQr: string;
  patientSettings: string;
  // Doctor sidebar
  doctorOverview: string;
  doctorSessions: string;
  doctorDrafts: string;
  doctorPatients: string;
  doctorNewConsultation: string;
  doctorPrescriptions: string;
  doctorLabs: string;
  doctorSettings: string;
  // Admin sidebar
  adminOverview: string;
  adminDoctors: string;
  adminPatients: string;
  adminPharmacists: string;
  adminSessions: string;
  adminReports: string;
  adminSettings: string;
  // Pharmacist sidebar
  pharmOverview: string;
  pharmPrescriptions: string;
  pharmInventory: string;
  pharmLog: string;
  pharmSettings: string;
  // Dashboard overview common
  dashWelcome: string;
  dashGoodMorning: string;
  dashGoodAfternoon: string;
  dashGoodEvening: string;
  // Patient dashboard
  patientDashTitle: string;
  patientTodaySchedule: string;
  patientDosesTaken: string;
  patientAllDosesToday: string;
  patientUnmarkMed: string;
  patientUnmarkConfirm: string;
  patientUnmarkYes: string;
  patientMissedDoses: string;
  patientMissedDesc: string;
  patientActiveRx: string;
  patientNoRx: string;
  patientRecentVisits: string;
  patientNoVisits: string;
  patientEmergencyQr: string;
  patientQrDesc: string;
  patientDownloadQr: string;
  patientUploadDoc: string;
  patientUploadDesc: string;
  patientSelectCategory: string;
  patientSelectFile: string;
  patientUploadBtn: string;
  patientLabReports: string;
  patientNoLabs: string;
  // Doctor dashboard
  doctorDashTitle: string;
  doctorTotalPatients: string;
  doctorTotalSessions: string;
  doctorPendingPrescriptions: string;
  doctorStartConsultation: string;
  doctorSearchPatient: string;
  doctorScanQr: string;
  doctorPatientHistory: string;
  doctorNoSessions: string;
  doctorNoPatients: string;
  doctorNewSession: string;
  doctorVoiceNote: string;
  doctorGenerateRx: string;
  doctorSaveRx: string;
  // Admin dashboard
  adminDashTitle: string;
  adminTotalDoctors: string;
  adminTotalPatients: string;
  adminTotalPharmacists: string;
  adminTotalSessions: string;
  adminAddDoctor: string;
  adminAddPatient: string;
  adminAddPharmacist: string;
  adminSearchDoctors: string;
  adminSearchPatients: string;
  adminNoData: string;
  // Pharmacist dashboard
  pharmDashTitle: string;
  pharmPendingRx: string;
  pharmDispensedToday: string;
  pharmInventoryCount: string;
  pharmReviewRx: string;
  pharmMarkDispensed: string;
  pharmSearchMeds: string;
  pharmNoRx: string;
  pharmNoMeds: string;
  // Settings common
  settingsTitle: string;
  settingsLanguagePref: string;
  settingsSaveChanges: string;
  settingsSaved: string;
  // TopBar
  topBarNotifications: string;
  topBarNoNotifications: string;
  // Patient medicines & pharmacy
  patientTimeMorning: string;
  patientTimeAfternoon: string;
  patientTimeEvening: string;
  patientTimeBedtime: string;
  patientWindowMorning: string;
  patientWindowAfternoon: string;
  patientWindowEvening: string;
  patientWindowBedtime: string;
  patientTake: string;
  patientTaken: string;
  patientTakenLate: string;
  patientMedCalendar: string;
  patientNoMedYet: string;
  patientNoMedYetSub: string;
  patientActiveMeds: string;
  patientAlerts: string;
  patientNoAlerts: string;
  patientPharmacy: string;
  patientPharmShop: string;
  patientPharmMyOrders: string;
  patientPrefillPrompt: string;
  patientPrefillBtn: string;
  patientPharmAllCat: string;
  patientPharmNoMeds: string;
  patientPharmCartEmpty: string;
  patientCartTitle: string;
  // Records tab
  recordsConsultationHistory: string;
  recordsHealthTimeline: string;
  recordsNoRecords: string;
  recordsDiagnosis: string;
  recordsVitals: string;
  recordsTranslating: string;
  recordsPrescribedMedicines: string;
  recordsIcdCodes: string;
  recordsConsultationNotes: string;
}

// ─── English Translations ──────────────────────────────────────────────────────
const en: Translations = {
  loading: "Loading…",
  save: "Save",
  cancel: "Cancel",
  back: "Back",
  next: "Next",
  submit: "Submit",
  search: "Search",
  close: "Close",
  yes: "Yes",
  no: "No",
  add: "Add",
  edit: "Edit",
  delete: "Delete",
  refresh: "Refresh",
  download: "Download",
  upload: "Upload",
  view: "View",
  confirm: "Confirm",
  errorOccurred: "An error occurred. Please try again.",
  noData: "No data available.",
  actions: "Actions",
  status: "Status",
  details: "Details",
  settings: "Settings",
  profile: "Profile",
  name: "Name",
  email: "Email",
  phone: "Phone",
  dob: "Date of Birth",
  gender: "Gender",
  bloodGroup: "Blood Group",
  address: "Address",
  languages: "Languages",
  date: "Date",
  time: "Time",
  // Navbar
  navLogin: "Login",
  navGetStarted: "Get Started",
  // Landing
  landingBadge: "AI-Powered Healthcare Platform",
  landingHero: "From Voice to Verified Clinical Notes —",
  landingHeroHighlight: "Instantly",
  landingSubtitle: "Reduce documentation burden, prevent medication errors, and unify fragmented health records — purpose-built for Indian healthcare providers and patients.",
  landingStartFree: "Start for Free",
  landingHipaa: "HIPAA-aligned",
  landingBuiltForIndia: "Built for India",
  landingRealTimeAI: "Real-time AI",
  landingSoapAuto: "SOAP Note — Auto-generated",
  landingFeaturesTitle: "Everything Your Clinic Needs",
  landingFeature1Title: "Clinical Documentation",
  landingFeature1Items: ["Voice-to-SOAP notes in real-time", "Multilingual patient summaries", "ICD-10 auto-coding from transcripts"],
  landingFeature2Title: "Medication Safety",
  landingFeature2Items: ["Prescription digitizer with OCR", "Drug interaction checker", "Smart adherence reminders"],
  landingFeature3Title: "Health Records",
  landingFeature3Items: ["Longitudinal patient timeline", "Multi-format document ingestion", "Emergency QR code system"],
  landingHowTitle: "Simple Workflow, Powerful Outcomes",
  landingStep1: "Doctor speaks during consultation",
  landingStep2: "AI transcribes + structures the note",
  landingStep3: "Patient gets multilingual summary",
  landingStep4: "Records auto-aggregated into timeline",
  landingForDoctors: "For Doctors",
  landingDoctorCta: "Start Documenting",
  landingDoctorBenefits: [
    "Voice-powered SOAP notes save 2+ hours daily",
    "Auto-coded ICD-10 from clinical conversations",
    "Full patient history at a glance",
    "Drug interaction alerts before prescribing",
  ],
  landingForPatients: "For Patients",
  landingPatientCta: "Create Your Profile",
  landingPatientBenefits: [
    "Receive visit summaries in your own language",
    "Never miss a dose with smart reminders",
    "All records in one longitudinal timeline",
    "Emergency QR code for instant medical access",
  ],
  landingQrTitle: "Emergency QR — Life-Saving in Seconds",
  landingQrDesc: "Every patient gets a unique QR code that emergency responders can scan to instantly access critical medical information — no login required.",
  landingQrCta: "Get Your QR",
  landingEmergencyCard: "Emergency Card",
  // Login
  loginWelcome: "Welcome",
  loginSubtitle: "Sign in to your account to continue.",
  loginTagline: "AI-powered clinical platform for modern Indian healthcare.",
  loginEmailPhone: "Email or Phone Number",
  loginPassword: "Password",
  loginBtn: "Login",
  loginLoading: "Signing in...",
  loginForgot: "Reset password?",
  loginNoAccount: "Don't have an account?",
  loginSignUp: "Sign up",
  loginDoctorPharmacist: "Are you a Doctor or Pharmacist? Use your institutional credentials.",
  loginUnverifiedTitle: "Account not yet activated",
  loginUnverifiedMsg: "Please check your email for the activation code to set your password.",
  loginActivate: "Activate my account →",
  // Footer
  footerTagline: "AI-powered clinical platform built for Indian healthcare.",
  footerProduct: "Product",
  footerFeatures: "Features",
  footerHowItWorks: "How It Works",
  footerPricing: "Pricing",
  footerApi: "API",
  footerCompany: "Company",
  footerAbout: "About",
  footerCareers: "Careers",
  footerBlog: "Blog",
  footerPress: "Press",
  footerContact: "Contact",
  footerCopyright: "© 2025 MediFlow. Built for Indian Healthcare.",
  // NotFound
  notFoundTitle: "Oops! Page not found",
  notFoundMsg: "The page you're looking for doesn't exist.",
  notFoundHome: "Return to Home",
  // Unauthorized
  unauthorizedTitle: "Access Denied",
  unauthorizedMsg: "You don't have permission to view this page.",
  unauthorizedHome: "Go to Dashboard",
  // Sidebar / Logout
  sidebarLogout: "Logout",
  sidebarLogoutConfirm: "Are you sure you want to logout from your account?",
  sidebarLogoutCancel: "Cancel",
  sidebarLogoutBtn: "Logout",
  // Patient sidebar
  patientOverview: "Overview",
  patientRecords: "My Records",
  patientMedicines: "Medicines",
  patientLabs: "Lab Reports",
  patientUpload: "Upload Documents",
  patientQr: "Emergency QR",
  patientSettings: "Settings",
  // Doctor sidebar
  doctorOverview: "Overview",
  doctorSessions: "My Sessions",
  doctorDrafts: "Drafts",
  doctorPatients: "Patients",
  doctorNewConsultation: "New Consultation",
  doctorPrescriptions: "Prescriptions",
  doctorLabs: "Lab Reports",
  doctorSettings: "Settings",
  // Admin sidebar
  adminOverview: "Overview",
  adminDoctors: "Doctors",
  adminPatients: "Patients",
  adminPharmacists: "Pharmacists",
  adminSessions: "Sessions",
  adminReports: "Reports",
  adminSettings: "Settings",
  // Pharmacist sidebar
  pharmOverview: "Overview",
  pharmPrescriptions: "Prescriptions Queue",
  pharmInventory: "Medicine Inventory",
  pharmLog: "Dispensing Log",
  pharmSettings: "Settings",
  // Dashboard common
  dashWelcome: "Welcome",
  dashGoodMorning: "Good morning",
  dashGoodAfternoon: "Good afternoon",
  dashGoodEvening: "Good evening",
  // Patient dashboard
  patientDashTitle: "Patient Dashboard",
  patientTodaySchedule: "Today's Schedule",
  patientDosesTaken: "doses taken",
  patientAllDosesToday: "All doses taken for today!",
  patientUnmarkMed: "Unmark Medicine?",
  patientUnmarkConfirm: "Are you sure you want to mark this medicine as not taken? This will decrease your progress for today.",
  patientUnmarkYes: "Yes, Unmark",
  patientMissedDoses: "Missed Doses",
  patientMissedDesc: "These doses were scheduled but not taken.",
  patientActiveRx: "Active Prescriptions",
  patientNoRx: "No active prescriptions.",
  patientRecentVisits: "Recent Visits",
  patientNoVisits: "No recent visits.",
  patientEmergencyQr: "Emergency QR Code",
  patientQrDesc: "Show this QR code in emergencies for instant access to your medical information.",
  patientDownloadQr: "Download QR",
  patientUploadDoc: "Upload Documents",
  patientUploadDesc: "Upload your medical documents, lab reports, and scans.",
  patientSelectCategory: "Select Category",
  patientSelectFile: "Select File",
  patientUploadBtn: "Upload",
  patientLabReports: "Lab Reports",
  patientNoLabs: "No lab reports uploaded yet.",
  // Doctor dashboard
  doctorDashTitle: "Doctor Dashboard",
  doctorTotalPatients: "Total Patients",
  doctorTotalSessions: "Total Sessions",
  doctorPendingPrescriptions: "Pending Prescriptions",
  doctorStartConsultation: "Start Consultation",
  doctorSearchPatient: "Search patient by name or phone…",
  doctorScanQr: "Scan Patient QR",
  doctorPatientHistory: "Patient History",
  doctorNoSessions: "No sessions yet.",
  doctorNoPatients: "No patients found.",
  doctorNewSession: "New Session",
  doctorVoiceNote: "Voice Note",
  doctorGenerateRx: "Generate Prescription",
  doctorSaveRx: "Save Prescription",
  // Admin dashboard
  adminDashTitle: "Admin Dashboard",
  adminTotalDoctors: "Total Doctors",
  adminTotalPatients: "Total Patients",
  adminTotalPharmacists: "Total Pharmacists",
  adminTotalSessions: "Total Sessions",
  adminAddDoctor: "Add Doctor",
  adminAddPatient: "Add Patient",
  adminAddPharmacist: "Add Pharmacist",
  adminSearchDoctors: "Search doctors…",
  adminSearchPatients: "Search patients…",
  adminNoData: "No records found.",
  // Pharmacist dashboard
  pharmDashTitle: "Pharmacist Dashboard",
  pharmPendingRx: "Pending Prescriptions",
  pharmDispensedToday: "Dispensed Today",
  pharmInventoryCount: "Medicine Inventory",
  pharmReviewRx: "Review Prescription",
  pharmMarkDispensed: "Mark as Dispensed",
  pharmSearchMeds: "Search medicines…",
  pharmNoRx: "No prescriptions in queue.",
  pharmNoMeds: "No medicines in inventory.",
  // Settings
  settingsTitle: "Settings",
  settingsLanguagePref: "Preferred Language",
  settingsSaveChanges: "Save Changes",
  settingsSaved: "Changes saved!",
  // TopBar
  topBarNotifications: "Notifications",
  topBarNoNotifications: "No new notifications.",
  // Patient medicines & pharmacy
  patientTimeMorning: "Morning",
  patientTimeAfternoon: "Afternoon",
  patientTimeEvening: "Evening",
  patientTimeBedtime: "Bedtime",
  patientWindowMorning: "6 AM – 11 AM",
  patientWindowAfternoon: "12 PM – 3 PM",
  patientWindowEvening: "5 PM – 8 PM",
  patientWindowBedtime: "9 PM – 11 PM",
  patientTake: "Take",
  patientTaken: "Taken",
  patientTakenLate: "Taken Late",
  patientMedCalendar: "Medicine Calendar",
  patientNoMedYet: "No medications prescribed yet.",
  patientNoMedYetSub: "Your medication schedule will appear here after a consultation.",
  patientActiveMeds: "Active Medications",
  patientAlerts: "Alerts",
  patientNoAlerts: "No alerts",
  patientPharmacy: "Pharmacy",
  patientPharmShop: "Shop",
  patientPharmMyOrders: "My Orders",
  patientPrefillPrompt: "Doctor prescription available — pre-fill cart?",
  patientPrefillBtn: "Pre-fill Cart",
  patientPharmAllCat: "All Categories",
  patientPharmNoMeds: "No medicines available.",
  patientPharmCartEmpty: "Your cart is empty",
  patientCartTitle: "Cart",
  // Records tab
  recordsConsultationHistory: "Consultation History",
  recordsHealthTimeline: "Health Timeline",
  recordsNoRecords: "No records found.",
  recordsDiagnosis: "Diagnosis",
  recordsVitals: "Vitals",
  recordsTranslating: "Translating…",
  recordsPrescribedMedicines: "Prescribed Medicines",
  recordsIcdCodes: "ICD-10 Codes",
  recordsConsultationNotes: "Consultation Notes",
};

// ─── Hindi Translations ────────────────────────────────────────────────────────
const hi: Translations = {
  loading: "लोड हो रहा है…",
  save: "सहेजें",
  cancel: "रद्द करें",
  back: "वापस",
  next: "आगे",
  submit: "जमा करें",
  search: "खोजें",
  close: "बंद करें",
  yes: "हाँ",
  no: "नहीं",
  add: "जोड़ें",
  edit: "संपादित करें",
  delete: "हटाएँ",
  refresh: "ताज़ा करें",
  download: "डाउनलोड",
  upload: "अपलोड",
  view: "देखें",
  confirm: "पुष्टि करें",
  errorOccurred: "कोई त्रुटि हुई। कृपया पुनः प्रयास करें।",
  noData: "कोई डेटा उपलब्ध नहीं।",
  actions: "कार्रवाई",
  status: "स्थिति",
  details: "विवरण",
  settings: "सेटिंग्स",
  profile: "प्रोफाइल",
  name: "नाम",
  email: "ईमेल",
  phone: "फ़ोन",
  dob: "जन्म तिथि",
  gender: "लिंग",
  bloodGroup: "रक्त समूह",
  address: "पता",
  languages: "भाषाएँ",
  date: "तारीख",
  time: "समय",
  // Navbar
  navLogin: "लॉगिन",
  navGetStarted: "शुरू करें",
  // Landing
  landingBadge: "AI-आधारित स्वास्थ्य सेवा प्लेटफ़ॉर्म",
  landingHero: "आवाज़ से सत्यापित क्लिनिकल नोट्स तक —",
  landingHeroHighlight: "तुरंत",
  landingSubtitle: "दस्तावेज़ीकरण का बोझ कम करें, दवा की गलतियाँ रोकें, और बिखरे स्वास्थ्य रिकॉर्ड को एकीकृत करें — भारतीय स्वास्थ्य सेवा प्रदाताओं और मरीजों के लिए बनाया गया।",
  landingStartFree: "मुफ़्त शुरू करें",
  landingHipaa: "HIPAA-अनुरूप",
  landingBuiltForIndia: "भारत के लिए बनाया",
  landingRealTimeAI: "रीयल-टाइम AI",
  landingSoapAuto: "SOAP नोट — स्वतः-निर्मित",
  landingFeaturesTitle: "आपके क्लिनिक को जो चाहिए वो सब",
  landingFeature1Title: "क्लिनिकल दस्तावेज़ीकरण",
  landingFeature1Items: ["रीयल-टाइम में आवाज़ से SOAP नोट्स", "बहुभाषी मरीज़ सारांश", "ट्रांसक्रिप्ट से ICD-10 स्वत: कोडिंग"],
  landingFeature2Title: "दवा सुरक्षा",
  landingFeature2Items: ["OCR के साथ प्रिस्क्रिप्शन डिजिटाइज़र", "दवा पारस्परिक क्रिया जाँचकर्ता", "स्मार्ट अनुपालन अनुस्मारक"],
  landingFeature3Title: "स्वास्थ्य रिकॉर्ड",
  landingFeature3Items: ["दीर्घकालिक मरीज़ टाइमलाइन", "बहु-प्रारूप दस्तावेज़ अंतर्ग्रहण", "आपातकालीन QR कोड प्रणाली"],
  landingHowTitle: "सरल कार्यप्रवाह, शक्तिशाली परिणाम",
  landingStep1: "परामर्श के दौरान डॉक्टर बोलते हैं",
  landingStep2: "AI नोट को ट्रांसक्राइब और संरचित करता है",
  landingStep3: "मरीज़ को बहुभाषी सारांश मिलता है",
  landingStep4: "रिकॉर्ड टाइमलाइन में स्वत: जुड़ जाते हैं",
  landingForDoctors: "डॉक्टरों के लिए",
  landingDoctorCta: "दस्तावेज़ीकरण शुरू करें",
  landingDoctorBenefits: [
    "आवाज़-संचालित SOAP नोट्स प्रतिदिन 2+ घंटे बचाते हैं",
    "क्लिनिकल बातचीत से स्वत: ICD-10 कोडेड",
    "एक नज़र में पूरा मरीज़ इतिहास",
    "प्रिस्क्राइब करने से पहले दवा इंटरैक्शन अलर्ट",
  ],
  landingForPatients: "मरीज़ों के लिए",
  landingPatientCta: "अपना प्रोफाइल बनाएं",
  landingPatientBenefits: [
    "अपनी भाषा में विज़िट सारांश प्राप्त करें",
    "स्मार्ट रिमाइंडर से कोई खुराक न चूकें",
    "सभी रिकॉर्ड एक दीर्घकालिक टाइमलाइन में",
    "तुरंत चिकित्सा पहुँच के लिए आपातकालीन QR कोड",
  ],
  landingQrTitle: "आपातकालीन QR — सेकंडों में जीवन-रक्षक",
  landingQrDesc: "हर मरीज़ को एक अद्वितीय QR कोड मिलता है जिसे आपातकालीन चिकित्सक स्कैन करके तुरंत महत्वपूर्ण चिकित्सा जानकारी देख सकते हैं — बिना लॉगिन के।",
  landingQrCta: "अपना QR प्राप्त करें",
  landingEmergencyCard: "आपातकालीन कार्ड",
  // Login
  loginWelcome: "वापस स्वागत है",
  loginSubtitle: "जारी रखने के लिए अपने खाते में साइन इन करें।",
  loginTagline: "आधुनिक भारतीय स्वास्थ्य सेवा के लिए AI-संचालित क्लिनिकल प्लेटफ़ॉर्म।",
  loginEmailPhone: "ईमेल या फ़ोन नंबर",
  loginPassword: "पासवर्ड",
  loginBtn: "लॉगिन करें",
  loginLoading: "साइन इन हो रहा है...",
  loginForgot: "पासवर्ड रीसेट करें?",
  loginNoAccount: "खाता नहीं है?",
  loginSignUp: "साइन अप करें",
  loginDoctorPharmacist: "क्या आप डॉक्टर या फार्मासिस्ट हैं? अपनी संस्थागत साख का उपयोग करें।",
  loginUnverifiedTitle: "खाता अभी सक्रिय नहीं है",
  loginUnverifiedMsg: "कृपया पासवर्ड सेट करने के लिए अपने ईमेल में सक्रियता कोड देखें।",
  loginActivate: "मेरा खाता सक्रिय करें →",
  // Footer
  footerTagline: "भारतीय स्वास्थ्य सेवा के लिए AI-संचालित क्लिनिकल प्लेटफ़ॉर्म।",
  footerProduct: "उत्पाद",
  footerFeatures: "विशेषताएँ",
  footerHowItWorks: "कैसे काम करता है",
  footerPricing: "मूल्य निर्धारण",
  footerApi: "API",
  footerCompany: "कंपनी",
  footerAbout: "हमारे बारे में",
  footerCareers: "करियर",
  footerBlog: "ब्लॉग",
  footerPress: "प्रेस",
  footerContact: "संपर्क",
  footerCopyright: "© 2025 MediFlow. भारतीय स्वास्थ्य सेवा के लिए निर्मित।",
  // NotFound
  notFoundTitle: "अरे! पृष्ठ नहीं मिला",
  notFoundMsg: "जो पृष्ठ आप ढूंढ रहे हैं वह मौजूद नहीं है।",
  notFoundHome: "होम पर वापस जाएं",
  // Unauthorized
  unauthorizedTitle: "पहुँच नहीं है",
  unauthorizedMsg: "आपको इस पृष्ठ को देखने की अनुमति नहीं है।",
  unauthorizedHome: "डैशबोर्ड पर जाएं",
  // Sidebar / Logout
  sidebarLogout: "लॉगआउट",
  sidebarLogoutConfirm: "क्या आप वाकई अपने खाते से लॉगआउट करना चाहते हैं?",
  sidebarLogoutCancel: "रद्द करें",
  sidebarLogoutBtn: "लॉगआउट करें",
  // Patient sidebar
  patientOverview: "अवलोकन",
  patientRecords: "मेरे रिकॉर्ड",
  patientMedicines: "दवाइयाँ",
  patientLabs: "लैब रिपोर्ट",
  patientUpload: "दस्तावेज़ अपलोड",
  patientQr: "आपातकालीन QR",
  patientSettings: "सेटिंग्स",
  // Doctor sidebar
  doctorOverview: "अवलोकन",
  doctorSessions: "मेरे सत्र",
  doctorDrafts: "ड्राफ्ट",
  doctorPatients: "मरीज़",
  doctorNewConsultation: "नई परामर्श",
  doctorPrescriptions: "प्रिस्क्रिप्शन",
  doctorLabs: "लैब रिपोर्ट",
  doctorSettings: "सेटिंग्स",
  // Admin sidebar
  adminOverview: "अवलोकन",
  adminDoctors: "डॉक्टर",
  adminPatients: "मरीज़",
  adminPharmacists: "फार्मासिस्ट",
  adminSessions: "सत्र",
  adminReports: "रिपोर्ट",
  adminSettings: "सेटिंग्स",
  // Pharmacist sidebar
  pharmOverview: "अवलोकन",
  pharmPrescriptions: "प्रिस्क्रिप्शन कतार",
  pharmInventory: "दवा भंडार",
  pharmLog: "वितरण लॉग",
  pharmSettings: "सेटिंग्स",
  // Dashboard common
  dashWelcome: "स्वागत है",
  dashGoodMorning: "सुप्रभात",
  dashGoodAfternoon: "नमस्कार",
  dashGoodEvening: "शुभ संध्या",
  // Patient dashboard
  patientDashTitle: "मरीज़ डैशबोर्ड",
  patientTodaySchedule: "आज का कार्यक्रम",
  patientDosesTaken: "खुराकें ली गईं",
  patientAllDosesToday: "आज की सभी खुराकें ली गईं!",
  patientUnmarkMed: "दवाई अचिह्नित करें?",
  patientUnmarkConfirm: "क्या आप इस दवाई को 'नहीं ली' के रूप में चिह्नित करना चाहते हैं? इससे आज की प्रगति कम हो जाएगी।",
  patientUnmarkYes: "हाँ, अचिह्नित करें",
  patientMissedDoses: "छूटी हुई खुराकें",
  patientMissedDesc: "ये खुराकें निर्धारित थीं लेकिन नहीं ली गईं।",
  patientActiveRx: "सक्रिय प्रिस्क्रिप्शन",
  patientNoRx: "कोई सक्रिय प्रिस्क्रिप्शन नहीं।",
  patientRecentVisits: "हालिया विज़िट",
  patientNoVisits: "कोई हालिया विज़िट नहीं।",
  patientEmergencyQr: "आपातकालीन QR कोड",
  patientQrDesc: "आपातकाल में यह QR कोड दिखाएं ताकि तुरंत आपकी चिकित्सा जानकारी देखी जा सके।",
  patientDownloadQr: "QR डाउनलोड करें",
  patientUploadDoc: "दस्तावेज़ अपलोड करें",
  patientUploadDesc: "अपने मेडिकल दस्तावेज़, लैब रिपोर्ट और स्कैन अपलोड करें।",
  patientSelectCategory: "श्रेणी चुनें",
  patientSelectFile: "फ़ाइल चुनें",
  patientUploadBtn: "अपलोड करें",
  patientLabReports: "लैब रिपोर्ट",
  patientNoLabs: "अभी तक कोई लैब रिपोर्ट अपलोड नहीं की गई।",
  // Doctor dashboard
  doctorDashTitle: "डॉक्टर डैशबोर्ड",
  doctorTotalPatients: "कुल मरीज़",
  doctorTotalSessions: "कुल सत्र",
  doctorPendingPrescriptions: "लंबित प्रिस्क्रिप्शन",
  doctorStartConsultation: "परामर्श शुरू करें",
  doctorSearchPatient: "मरीज़ को नाम या फ़ोन से खोजें…",
  doctorScanQr: "मरीज़ QR स्कैन करें",
  doctorPatientHistory: "मरीज़ इतिहास",
  doctorNoSessions: "अभी तक कोई सत्र नहीं।",
  doctorNoPatients: "कोई मरीज़ नहीं मिला।",
  doctorNewSession: "नया सत्र",
  doctorVoiceNote: "वॉइस नोट",
  doctorGenerateRx: "प्रिस्क्रिप्शन बनाएं",
  doctorSaveRx: "प्रिस्क्रिप्शन सहेजें",
  // Admin dashboard
  adminDashTitle: "व्यवस्थापक डैशबोर्ड",
  adminTotalDoctors: "कुल डॉक्टर",
  adminTotalPatients: "कुल मरीज़",
  adminTotalPharmacists: "कुल फार्मासिस्ट",
  adminTotalSessions: "कुल सत्र",
  adminAddDoctor: "डॉक्टर जोड़ें",
  adminAddPatient: "मरीज़ जोड़ें",
  adminAddPharmacist: "फार्मासिस्ट जोड़ें",
  adminSearchDoctors: "डॉक्टर खोजें…",
  adminSearchPatients: "मरीज़ खोजें…",
  adminNoData: "कोई रिकॉर्ड नहीं मिला।",
  // Pharmacist dashboard
  pharmDashTitle: "फार्मासिस्ट डैशबोर्ड",
  pharmPendingRx: "लंबित प्रिस्क्रिप्शन",
  pharmDispensedToday: "आज वितरित",
  pharmInventoryCount: "दवा भंडार",
  pharmReviewRx: "प्रिस्क्रिप्शन समीक्षा करें",
  pharmMarkDispensed: "वितरित के रूप में चिह्नित करें",
  pharmSearchMeds: "दवाइयाँ खोजें…",
  pharmNoRx: "कतार में कोई प्रिस्क्रिप्शन नहीं।",
  pharmNoMeds: "भंडार में कोई दवाई नहीं।",
  // Settings
  settingsTitle: "सेटिंग्स",
  settingsLanguagePref: "पसंदीदा भाषा",
  settingsSaveChanges: "परिवर्तन सहेजें",
  settingsSaved: "परिवर्तन सहेजे गए!",
  // TopBar
  topBarNotifications: "सूचनाएँ",
  topBarNoNotifications: "कोई नई सूचना नहीं।",
  // Patient medicines & pharmacy
  patientTimeMorning: "सुबह",
  patientTimeAfternoon: "दोपहर",
  patientTimeEvening: "शाम",
  patientTimeBedtime: "सोने से पहले",
  patientWindowMorning: "सुबह 6 – 11 बजे",
  patientWindowAfternoon: "दोपहर 12 – 3 बजे",
  patientWindowEvening: "शाम 5 – 8 बजे",
  patientWindowBedtime: "रात 9 – 11 बजे",
  patientTake: "लें",
  patientTaken: "ले लिया",
  patientTakenLate: "देरी से लिया",
  patientMedCalendar: "दवाई कैलेंडर",
  patientNoMedYet: "अभी तक कोई दवाई नहीं।",
  patientNoMedYetSub: "परामर्श के बाद दवाई कार्यक्रम यहाँ दिखेगा।",
  patientActiveMeds: "सक्रिय दवाइयाँ",
  patientAlerts: "अलर्ट",
  patientNoAlerts: "कोई अलर्ट नहीं",
  patientPharmacy: "फार्मेसी",
  patientPharmShop: "खरीदारी",
  patientPharmMyOrders: "मेरे ऑर्डर",
  patientPrefillPrompt: "डॉक्टर का नुस्खा उपलब्ध — कार्ट भरें?",
  patientPrefillBtn: "कार्ट भरें",
  patientPharmAllCat: "सभी श्रेणियाँ",
  patientPharmNoMeds: "कोई दवाई उपलब्ध नहीं।",
  patientPharmCartEmpty: "आपकी कार्ट खाली है",
  patientCartTitle: "कार्ट",
  // Records tab
  recordsConsultationHistory: "परामर्श इतिहास",
  recordsHealthTimeline: "स्वास्थ्य टाइमलाइन",
  recordsNoRecords: "कोई रिकॉर्ड नहीं मिला।",
  recordsDiagnosis: "निदान",
  recordsVitals: "जीवन संकेत",
  recordsTranslating: "अनुवाद हो रहा है…",
  recordsPrescribedMedicines: "निर्धारित दवाइयाँ",
  recordsIcdCodes: "ICD-10 कोड",
  recordsConsultationNotes: "परामर्श नोट्स",
};

// ─── Telugu Translations ───────────────────────────────────────────────────────
const te: Translations = {
  loading: "లోడ్ అవుతోంది…",
  save: "సేవ్ చేయండి",
  cancel: "రద్దు చేయండి",
  back: "వెనక్కి",
  next: "తదుపరి",
  submit: "సమర్పించండి",
  search: "వెతకండి",
  close: "మూసివేయండి",
  yes: "అవును",
  no: "కాదు",
  add: "జోడించండి",
  edit: "మార్చండి",
  delete: "తొలగించండి",
  refresh: "తాజాపరచండి",
  download: "డౌన్లోడ్",
  upload: "అప్లోడ్",
  view: "చూడండి",
  confirm: "నిర్ధారించండి",
  errorOccurred: "లోపం జరిగింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
  noData: "సమాచారం అందుబాటులో లేదు.",
  actions: "చర్యలు",
  status: "స్థితి",
  details: "వివరాలు",
  settings: "సెట్టింగ్‌లు",
  profile: "ప్రొఫైల్",
  name: "పేరు",
  email: "ఇమెయిల్",
  phone: "ఫోన్",
  dob: "పుట్టిన తేదీ",
  gender: "లింగం",
  bloodGroup: "రక్త సమూహం",
  address: "చిరునామా",
  languages: "భాషలు",
  date: "తేదీ",
  time: "సమయం",
  // Navbar
  navLogin: "లాగిన్",
  navGetStarted: "ప్రారంభించండి",
  // Landing
  landingBadge: "AI-ఆధారిత ఆరోగ్య సేవల వేదిక",
  landingHero: "మాట నుండి ధృవీకరించిన క్లినికల్ నోట్‌లకు —",
  landingHeroHighlight: "వెంటనే",
  landingSubtitle: "పత్రాల భారాన్ని తగ్గించండి, మందుల తప్పులు నివారించండి, చెల్లాచెదురైన ఆరోగ్య రికార్డులను ఏకం చేయండి — భారతీయ ఆరోగ్య సేవా అందించేవారికి మరియు రోగులకు ప్రత్యేకంగా నిర్మించబడింది.",
  landingStartFree: "ఉచితంగా ప్రారంభించండి",
  landingHipaa: "HIPAA-అనుగుణ్య",
  landingBuiltForIndia: "భారత్ కోసం నిర్మించినది",
  landingRealTimeAI: "రియల్-టైమ్ AI",
  landingSoapAuto: "SOAP నోట్ — స్వయంగా రూపొందింది",
  landingFeaturesTitle: "మీ క్లినిక్‌కు అవసరమైన అన్నీ",
  landingFeature1Title: "క్లినికల్ డాక్యుమెంటేషన్",
  landingFeature1Items: ["రియల్-టైమ్‌లో వాయిస్ నుండి SOAP నోట్లు", "బహుభాషా రోగి సారాంశాలు", "ట్రాన్స్క్రిప్ట్ నుండి ICD-10 స్వయంచాలక కోడింగ్"],
  landingFeature2Title: "మందుల భద్రత",
  landingFeature2Items: ["OCR తో ప్రిస్క్రిప్షన్ డిజిటైజర్", "మందుల పరస్పర చర్య తనిఖీ", "స్మార్ట్ అనుసరణ రిమైండర్లు"],
  landingFeature3Title: "ఆరోగ్య రికార్డులు",
  landingFeature3Items: ["దీర్ఘకాలిక రోగి టైమ్‌లైన్", "బహుళ-ఫార్మాట్ పత్రాల విలీనం", "అత్యవసర QR కోడ్ వ్యవస్థ"],
  landingHowTitle: "సరళమైన పని విధానం, శక్తివంతమైన ఫలితాలు",
  landingStep1: "సంప్రదింపు సమయంలో డాక్టర్ మాట్లాడుతారు",
  landingStep2: "AI నోట్‌ను ట్రాన్స్క్రైబ్ చేసి నిర్మించింది",
  landingStep3: "రోగికి బహుభాషా సారాంశం అందుతుంది",
  landingStep4: "రికార్డులు స్వయంచాలకంగా టైమ్‌లైన్‌లో చేరుతాయి",
  landingForDoctors: "డాక్టర్లకు",
  landingDoctorCta: "డాక్యుమెంటేషన్ ప్రారంభించండి",
  landingDoctorBenefits: [
    "వాయిస్-ఆధారిత SOAP నోట్లు రోజూ 2+ గంటలు ఆదా చేస్తాయి",
    "క్లినికల్ సంభాషణల నుండి స్వయంచాలక ICD-10 కోడ్",
    "ఒకే చూపులో రోగి చరిత్ర పూర్తి",
    "ప్రిస్క్రైబ్ చేయడానికి ముందు మందు పరస్పర చర్య హెచ్చరికలు",
  ],
  landingForPatients: "రోగులకు",
  landingPatientCta: "మీ ప్రొఫైల్ సృష్టించండి",
  landingPatientBenefits: [
    "మీ భాషలో విజిట్ సారాంశాలు పొందండి",
    "స్మార్ట్ రిమైండర్లతో ఏ డోస్ చిన్నది కాకండి",
    "అన్ని రికార్డులు ఒక దీర్ఘకాలిక టైమ్‌లైన్‌లో",
    "తక్షణ వైద్య ప్రాప్తి కోసం అత్యవసర QR కోడ్",
  ],
  landingQrTitle: "అత్యవసర QR — సెకన్లలో జీవితాన్ని రక్షించే సాధనం",
  landingQrDesc: "ప్రతి రోగికి ఒక ప్రత్యేక QR కోడ్ ఉంటుంది, అత్యవసర సేవలు స్కాన్ చేసి వెంటనే కీలక వైద్య సమాచారాన్ని చూడవచ్చు — లాగిన్ అవసరం లేదు.",
  landingQrCta: "మీ QR పొందండి",
  landingEmergencyCard: "అత్యవసర కార్డ్",
  // Login
  loginWelcome: "తిరిగి స్వాగతం",
  loginSubtitle: "కొనసాగించడానికి మీ ఖాతాలో సైన్ ఇన్ చేయండి.",
  loginTagline: "ఆధునిక భారతీయ ఆరోగ్య సేవ కోసం AI-ఆధారిత క్లినికల్ వేదిక.",
  loginEmailPhone: "ఇమెయిల్ లేదా ఫోన్ నంబర్",
  loginPassword: "పాస్వర్డ్",
  loginBtn: "లాగిన్ చేయండి",
  loginLoading: "సైన్ ఇన్ అవుతోంది...",
  loginForgot: "పాస్వర్డ్ రీసెట్ చేయాలా?",
  loginNoAccount: "ఖాతా లేదా?",
  loginSignUp: "సైన్ అప్ చేయండి",
  loginDoctorPharmacist: "మీరు డాక్టర్ లేదా ఫార్మాసిస్ట్ అయితే సంస్థ సాధనాలు వాడండి.",
  loginUnverifiedTitle: "ఖాతా ఇంకా సక్రియం కాలేదు",
  loginUnverifiedMsg: "పాస్వర్డ్ సెట్ చేయడానికి మీ ఇమెయిల్‌లో యాక్టివేషన్ కోడ్ చూడండి.",
  loginActivate: "నా ఖాతా సక్రియం చేయండి →",
  // Footer
  footerTagline: "భారతీయ ఆరోగ్య సేవ కోసం AI-ఆధారిత క్లినికల్ వేదిక.",
  footerProduct: "ఉత్పత్తి",
  footerFeatures: "లక్షణాలు",
  footerHowItWorks: "ఎలా పని చేస్తుందంటే",
  footerPricing: "ధర",
  footerApi: "API",
  footerCompany: "కంపెనీ",
  footerAbout: "మా గురించి",
  footerCareers: "ఉద్యోగాలు",
  footerBlog: "బ్లాగ్",
  footerPress: "మీడియా",
  footerContact: "సంప్రదించండి",
  footerCopyright: "© 2025 MediFlow. భారతీయ ఆరోగ్య సేవ కోసం నిర్మించబడింది.",
  // NotFound
  notFoundTitle: "అయ్యో! పేజీ దొరకలేదు",
  notFoundMsg: "మీరు వెతుకుతున్న పేజీ లేదు.",
  notFoundHome: "హోమ్‌కు తిరిగి వెళ్ళండి",
  // Unauthorized
  unauthorizedTitle: "అనుమతి లేదు",
  unauthorizedMsg: "ఈ పేజీని చూడటానికి మీకు అనుమతి లేదు.",
  unauthorizedHome: "డాష్‌బోర్డ్‌కు వెళ్ళండి",
  // Sidebar / Logout
  sidebarLogout: "లాగ్‌అవుట్",
  sidebarLogoutConfirm: "మీరు నిజంగా మీ ఖాతా నుండి లాగ్‌అవుట్ అవ్వాలనుకుంటున్నారా?",
  sidebarLogoutCancel: "రద్దు చేయండి",
  sidebarLogoutBtn: "లాగ్‌అవుట్ చేయండి",
  // Patient sidebar
  patientOverview: "అవలోకనం",
  patientRecords: "నా రికార్డులు",
  patientMedicines: "మందులు",
  patientLabs: "లాబ్ రిపోర్టులు",
  patientUpload: "పత్రాలు అప్లోడ్",
  patientQr: "అత్యవసర QR",
  patientSettings: "సెట్టింగ్‌లు",
  // Doctor sidebar
  doctorOverview: "అవలోకనం",
  doctorSessions: "నా సెషన్లు",
  doctorDrafts: "డ్రాఫ్ట్‌లు",
  doctorPatients: "రోగులు",
  doctorNewConsultation: "కొత్త సంప్రదింపు",
  doctorPrescriptions: "ప్రిస్క్రిప్షన్లు",
  doctorLabs: "లాబ్ రిపోర్టులు",
  doctorSettings: "సెట్టింగ్‌లు",
  // Admin sidebar
  adminOverview: "అవలోకనం",
  adminDoctors: "డాక్టర్లు",
  adminPatients: "రోగులు",
  adminPharmacists: "ఫార్మాసిస్టులు",
  adminSessions: "సెషన్లు",
  adminReports: "నివేదికలు",
  adminSettings: "సెట్టింగ్‌లు",
  // Pharmacist sidebar
  pharmOverview: "అవలోకనం",
  pharmPrescriptions: "ప్రిస్క్రిప్షన్ వరుస",
  pharmInventory: "మందుల నిల్వ",
  pharmLog: "వితరణ లాగ్",
  pharmSettings: "సెట్టింగ్‌లు",
  // Dashboard common
  dashWelcome: "స్వాగతం",
  dashGoodMorning: "శుభోదయం",
  dashGoodAfternoon: "శుభ మధ్యాహ్నం",
  dashGoodEvening: "శుభ సాయంత్రం",
  // Patient dashboard
  patientDashTitle: "రోగి డాష్‌బోర్డ్",
  patientTodaySchedule: "నేటి షెడ్యూల్",
  patientDosesTaken: "డోసులు తీసుకున్నారు",
  patientAllDosesToday: "నేటి అన్ని డోసులు తీసుకున్నారు!",
  patientUnmarkMed: "మందు తీసివేయాలా?",
  patientUnmarkConfirm: "మీరు ఈ మందును 'తీసుకోలేదు' అని మార్చాలనుకుంటున్నారా? ఇది నేటి పురోగతిని తగ్గిస్తుంది.",
  patientUnmarkYes: "అవును, తీసివేయండి",
  patientMissedDoses: "మిస్సయిన డోసులు",
  patientMissedDesc: "ఈ డోసులు నిర్ణయించబడ్డాయి కానీ తీసుకోలేదు.",
  patientActiveRx: "చురుకైన ప్రిస్క్రిప్షన్లు",
  patientNoRx: "చురుకైన ప్రిస్క్రిప్షన్లు లేవు.",
  patientRecentVisits: "ఇటీవలి విజిట్లు",
  patientNoVisits: "ఇటీవలి విజిట్లు లేవు.",
  patientEmergencyQr: "అత్యవసర QR కోడ్",
  patientQrDesc: "అత్యవసర పరిస్థితులలో ఈ QR కోడ్ చూపించండి, వెంటనే మీ వైద్య సమాచారం అందుబాటులో ఉంటుంది.",
  patientDownloadQr: "QR డౌన్లోడ్ చేయండి",
  patientUploadDoc: "పత్రాలు అప్లోడ్ చేయండి",
  patientUploadDesc: "మీ వైద్య పత్రాలు, లాబ్ రిపోర్టులు మరియు స్కాన్‌లు అప్లోడ్ చేయండి.",
  patientSelectCategory: "వర్గం ఎంచుకోండి",
  patientSelectFile: "ఫైల్ ఎంచుకోండి",
  patientUploadBtn: "అప్లోడ్ చేయండి",
  patientLabReports: "లాబ్ రిపోర్టులు",
  patientNoLabs: "ఇంకా లాబ్ రిపోర్టులు అప్లోడ్ చేయబడలేదు.",
  // Doctor dashboard
  doctorDashTitle: "డాక్టర్ డాష్‌బోర్డ్",
  doctorTotalPatients: "మొత్తం రోగులు",
  doctorTotalSessions: "మొత్తం సెషన్లు",
  doctorPendingPrescriptions: "పెండింగ్ ప్రిస్క్రిప్షన్లు",
  doctorStartConsultation: "సంప్రదింపు ప్రారంభించండి",
  doctorSearchPatient: "రోగిని పేరు లేదా ఫోన్ ద్వారా వెతకండి…",
  doctorScanQr: "రోగి QR స్కాన్ చేయండి",
  doctorPatientHistory: "రోగి చరిత్ర",
  doctorNoSessions: "ఇంకా సెషన్లు లేవు.",
  doctorNoPatients: "రోగులు దొరకలేదు.",
  doctorNewSession: "కొత్త సెషన్",
  doctorVoiceNote: "వాయిస్ నోట్",
  doctorGenerateRx: "ప్రిస్క్రిప్షన్ రూపొందించండి",
  doctorSaveRx: "ప్రిస్క్రిప్షన్ సేవ్ చేయండి",
  // Admin dashboard
  adminDashTitle: "నిర్వాహక డాష్‌బోర్డ్",
  adminTotalDoctors: "మొత్తం డాక్టర్లు",
  adminTotalPatients: "మొత్తం రోగులు",
  adminTotalPharmacists: "మొత్తం ఫార్మాసిస్టులు",
  adminTotalSessions: "మొత్తం సెషన్లు",
  adminAddDoctor: "డాక్టర్ జోడించండి",
  adminAddPatient: "రోగి జోడించండి",
  adminAddPharmacist: "ఫార్మాసిస్ట్ జోడించండి",
  adminSearchDoctors: "డాక్టర్లను వెతకండి…",
  adminSearchPatients: "రోగులను వెతకండి…",
  adminNoData: "రికార్డులు దొరకలేదు.",
  // Pharmacist dashboard
  pharmDashTitle: "ఫార్మాసిస్ట్ డాష్‌బోర్డ్",
  pharmPendingRx: "పెండింగ్ ప్రిస్క్రిప్షన్లు",
  pharmDispensedToday: "ఈరోజు పంపిణీ చేసారు",
  pharmInventoryCount: "మందుల నిల్వ",
  pharmReviewRx: "ప్రిస్క్రిప్షన్ సమీక్షించండి",
  pharmMarkDispensed: "పంపిణీగా గుర్తించండి",
  pharmSearchMeds: "మందులు వెతకండి…",
  pharmNoRx: "వరుసలో ప్రిస్క్రిప్షన్లు లేవు.",
  pharmNoMeds: "నిల్వలో మందులు లేవు.",
  // Settings
  settingsTitle: "సెట్టింగ్‌లు",
  settingsLanguagePref: "ఇష్టమైన భాష",
  settingsSaveChanges: "మార్పులు సేవ్ చేయండి",
  settingsSaved: "మార్పులు సేవ్ అయ్యాయి!",
  // TopBar
  topBarNotifications: "నోటిఫికేషన్లు",
  topBarNoNotifications: "కొత్త నోటిఫికేషన్లు లేవు.",
  // Patient medicines & pharmacy
  patientTimeMorning: "ఉదయం",
  patientTimeAfternoon: "మధ్యాహ్నం",
  patientTimeEvening: "సాయంత్రం",
  patientTimeBedtime: "నిద్రకు ముందు",
  patientWindowMorning: "ఉదయం 6 – 11",
  patientWindowAfternoon: "మధ్యాహ్నం 12 – 3",
  patientWindowEvening: "సాయంత్రం 5 – 8",
  patientWindowBedtime: "రాత్రి 9 – 11",
  patientTake: "తీసుకోండి",
  patientTaken: "తీసుకున్నారు",
  patientTakenLate: "ఆలస్యంగా తీసుకున్నారు",
  patientMedCalendar: "మందుల క్యాలెండర్",
  patientNoMedYet: "ఇంకా మందులు నిర్ణయించలేదు.",
  patientNoMedYetSub: "సంప్రదింపు తర్వాత మందుల షెడ్యూల్ ఇక్కడ కనిపిస్తుంది.",
  patientActiveMeds: "చురుకైన మందులు",
  patientAlerts: "హెచ్చరికలు",
  patientNoAlerts: "హెచ్చరికలు లేవు",
  patientPharmacy: "ఫార్మసీ",
  patientPharmShop: "షాపు",
  patientPharmMyOrders: "నా ఆర్డర్లు",
  patientPrefillPrompt: "డాక్టర్ ప్రిస్క్రిప్షన్ అందుబాటులో — కార్ట్ నింపాలా?",
  patientPrefillBtn: "కార్ట్ నింపండి",
  patientPharmAllCat: "అన్ని వర్గాలు",
  patientPharmNoMeds: "మందులు అందుబాటులో లేవు.",
  patientPharmCartEmpty: "మీ కార్ట్ ఖాళీగా ఉంది",
  patientCartTitle: "కార్ట్",
  // Records tab
  recordsConsultationHistory: "సంప్రదింపు చరిత్ర",
  recordsHealthTimeline: "ఆరోగ్య కాలక్రమం",
  recordsNoRecords: "రికార్డులు కనుగొనబడలేదు.",
  recordsDiagnosis: "నిర్ధారణ",
  recordsVitals: "జీవన సంకేతాలు",
  recordsTranslating: "అనువదిస్తోంది…",
  recordsPrescribedMedicines: "సూచించిన మందులు",
  recordsIcdCodes: "ICD-10 కోడ్‌లు",
  recordsConsultationNotes: "సంప్రదింపు నోట్స్",
};

export const TRANSLATIONS: Record<AppLanguage, Translations> = { en, hi, te };

// ─── Context ───────────────────────────────────────────────────────────────────
interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/** Map a preferredLanguage string (e.g. "Telugu", "Hindi", "English") → AppLanguage */
function mapProfileLang(preferredLanguage?: string): AppLanguage | null {
  if (!preferredLanguage) return null;
  const lower = preferredLanguage.toLowerCase();
  if (lower === "telugu" || lower === "te") return "te";
  if (lower === "hindi" || lower === "hi") return "hi";
  if (lower === "english" || lower === "en") return "en";
  return null;
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [language, setLanguageState] = useState<AppLanguage>(() => {
    // 1. Respect explicit localStorage choice first
    const stored = localStorage.getItem(LANG_KEY) as AppLanguage | null;
    if (stored && ["en", "hi", "te"].includes(stored)) return stored;
    // 2. Fall back to browser language
    const browser = navigator.language?.slice(0, 2);
    if (browser === "hi") return "hi";
    if (browser === "te") return "te";
    return "en";
  });

  // When user logs in / profile changes, sync language from their preference
  useEffect(() => {
    if (!user) return;
    const storedExplicit = localStorage.getItem(LANG_KEY + "_explicit");
    if (storedExplicit === "true") return; // user explicitly set a preference — honour it
    const profLang = mapProfileLang((user as any).preferredLanguage);
    if (profLang && profLang !== language) {
      setLanguageState(profLang);
    }
  }, [user]);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_KEY, lang);
    localStorage.setItem(LANG_KEY + "_explicit", "true");
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: TRANSLATIONS[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
};