import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDOB } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard, StatusBadge, SectionHeader } from "@/components/ui/custom-ui";
import {
  LayoutDashboard, CalendarDays, Users, PlusCircle, ClipboardList, FileText, Settings,
  Mic, MicOff, Search, ArrowRight, Plus, Trash2, RefreshCw, QrCode, Camera, X, CheckCircle, AlertTriangle, UserCheck, History, ChevronDown, ChevronUp
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { doctorApi, publicApi } from "@/lib/api";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu", "Odia"];

// (links defined inside component for i18n)

interface ScannedPatient {
  id?: string;
  name?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  languages?: string[];
  allergies?: string[];
  conditions?: string[];
  addedAt?: string;
}

// ---------- Knowledge maps (outside component, no re-render cost) ----------
const CONDITION_ICD10: Record<string, { code: string; desc: string }> = {
  "hypertension": { code: "I10", desc: "Essential (primary) hypertension" },
  "diabetes": { code: "E11.9", desc: "Type 2 diabetes mellitus, unspecified" },
  "type 2 diabetes": { code: "E11.9", desc: "Type 2 diabetes mellitus, unspecified" },
  "asthma": { code: "J45.909", desc: "Unspecified asthma, uncomplicated" },
  "heart disease": { code: "I25.10", desc: "Chronic ischemic heart disease, unspecified" },
  "hypothyroidism": { code: "E03.9", desc: "Hypothyroidism, unspecified" },
  "thyroid": { code: "E03.9", desc: "Thyroid disorder, unspecified" },
  "arthritis": { code: "M19.90", desc: "Unspecified osteoarthritis, unspecified site" },
  "anemia": { code: "D64.9", desc: "Anaemia, unspecified" },
  "depression": { code: "F32.9", desc: "Major depressive disorder, single episode, unspecified" },
  "anxiety": { code: "F41.9", desc: "Anxiety disorder, unspecified" },
  "copd": { code: "J44.9", desc: "Chronic obstructive pulmonary disease, unspecified" },
};

type MedRow = { name: string; dosage: string; frequency: string; duration: string; morning: boolean; afternoon: boolean; night: boolean; bedtime: boolean };
const CONDITION_MEDICINES: Record<string, MedRow[]> = {
  "hypertension": [{ name: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "30 days", morning: true, afternoon: false, night: false, bedtime: false }],
  "diabetes": [{ name: "Metformin", dosage: "500mg", frequency: "Twice daily", duration: "30 days", morning: true, afternoon: false, night: true, bedtime: false }],
  "type 2 diabetes": [{ name: "Metformin", dosage: "500mg", frequency: "Twice daily", duration: "30 days", morning: true, afternoon: false, night: true, bedtime: false }],
  "asthma": [{ name: "Salbutamol Inhaler", dosage: "100mcg", frequency: "As needed", duration: "30 days", morning: false, afternoon: false, night: false, bedtime: false }],
  "hypothyroidism": [{ name: "Levothyroxine", dosage: "50mcg", frequency: "Once daily", duration: "30 days", morning: true, afternoon: false, night: false, bedtime: false }],
  "thyroid": [{ name: "Levothyroxine", dosage: "50mcg", frequency: "Once daily", duration: "30 days", morning: true, afternoon: false, night: false, bedtime: false }],
  "arthritis": [{ name: "Ibuprofen", dosage: "400mg", frequency: "Twice daily", duration: "7 days", morning: true, afternoon: false, night: true, bedtime: false }],
  "anemia": [{ name: "Ferrous Sulfate", dosage: "325mg", frequency: "Once daily", duration: "30 days", morning: true, afternoon: false, night: false, bedtime: false }],
};
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inline timeline component for Doctor's patient history view
// ---------------------------------------------------------------------------
const PatientTimeline = ({ records, prescriptions }: { records: any[]; prescriptions: any[] }) => {
  const prescByRecordId = useMemo(() => {
    const map = new Map<string, any>();
    prescriptions.forEach((presc) => {
      const rid = presc.data?.recordId || presc.recordId;
      if (rid) map.set(String(rid), presc);
    });
    return map;
  }, [prescriptions]);

  // Records with or without linked prescription
  const entries = records.length > 0 ? records : prescriptions.map((presc) => ({
    _id: presc._id,
    timestamp: presc.createdAt,
    _virtPrescription: presc,
  }));

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consultation History ({entries.length} record{entries.length !== 1 ? "s" : ""})</p>
      {entries.map((rec: any) => {
        const presc = rec._virtPrescription || prescByRecordId.get(String(rec._id));
        const d = presc?.data || {};
        const editHistory: any[] = d.editHistory || [];
        return (
          <div key={rec._id} className="border border-border rounded-md bg-secondary/40 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
              <p className="text-xs font-medium text-foreground">
                {new Date(rec.timestamp || rec.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              {presc && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Prescription saved</span>}
            </div>
            <div className="p-3 space-y-3 text-xs">
              {/* Vitals */}
              {d.vitals && Object.values(d.vitals).some(Boolean) && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Vitals</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {d.vitals.bp && <span className="bg-background border border-border rounded px-2 py-1">BP: {d.vitals.bp}</span>}
                    {d.vitals.hr && <span className="bg-background border border-border rounded px-2 py-1">HR: {d.vitals.hr} bpm</span>}
                    {d.vitals.temperature && <span className="bg-background border border-border rounded px-2 py-1">Temp: {d.vitals.temperature}°F</span>}
                    {d.vitals.spO2 && <span className="bg-background border border-border rounded px-2 py-1">SpO₂: {d.vitals.spO2}%</span>}
                    {d.vitals.weight && <span className="bg-background border border-border rounded px-2 py-1">Wt: {d.vitals.weight} kg</span>}
                    {d.vitals.sugar && <span className="bg-background border border-border rounded px-2 py-1">Sugar: {d.vitals.sugar}</span>}
                  </div>
                </div>
              )}
              {/* SOAP */}
              {d.soapNote && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">SOAP Note</p>
                  <div className="space-y-1">
                    {d.soapNote.subjective && <p><span className="text-muted-foreground">S:</span> {d.soapNote.subjective}</p>}
                    {d.soapNote.objective && <p><span className="text-muted-foreground">O:</span> {d.soapNote.objective}</p>}
                    {d.soapNote.assessment && <p><span className="text-muted-foreground">A:</span> {d.soapNote.assessment}</p>}
                    {d.soapNote.plan && <p><span className="text-muted-foreground">P:</span> {d.soapNote.plan}</p>}
                  </div>
                </div>
              )}
              {/* Medicines */}
              {d.consultationMedicines && d.consultationMedicines.length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Medicines ({d.consultationMedicines.length})</p>
                  <div className="space-y-1">
                    {d.consultationMedicines.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 bg-background border border-border rounded px-2 py-1">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground">{m.dosage}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{m.frequency}</span>
                        {m.duration && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{m.duration}</span></>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* ICD-10 */}
              {d.icd10Codes && d.icd10Codes.length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">ICD-10 Codes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {d.icd10Codes.map((c: any, i: number) => (
                      <span key={i} className="bg-background border border-border rounded px-2 py-0.5 font-mono">{c.code} — {c.desc}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Edit history */}
              {editHistory.length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Edit History ({editHistory.length} update{editHistory.length !== 1 ? "s" : ""})</p>
                  <div className="space-y-1">
                    {editHistory.map((eh: any, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-muted-foreground">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                        <span>{new Date(eh.editedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {eh.editNote && <span>— {eh.editNote}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------

const DoctorDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "overview";
  const setTab = useCallback((t: string) => setSearchParams(t === "overview" ? {} : { tab: t }), [setSearchParams]);
  const { user, accessToken } = useAuth();
  const { t: tr } = useLanguage();
  const links = useMemo(() => [
    { label: tr.doctorOverview, to: "/dashboard/doctor", icon: LayoutDashboard },
    { label: tr.doctorSessions, to: "/dashboard/doctor?tab=sessions", icon: CalendarDays },
    { label: tr.doctorDrafts, to: "/dashboard/doctor?tab=drafts", icon: History },
    { label: tr.doctorPatients, to: "/dashboard/doctor?tab=patients", icon: Users },
    { label: tr.doctorNewConsultation, to: "/dashboard/doctor?tab=consultation", icon: PlusCircle },
    { label: tr.doctorPrescriptions, to: "/dashboard/doctor?tab=prescriptions", icon: ClipboardList },
    { label: tr.doctorLabs, to: "/dashboard/doctor?tab=labs", icon: FileText },
    { label: tr.doctorSettings, to: "/dashboard/doctor?tab=settings", icon: Settings },
  ], [tr]);

  const [recording, setRecording] = useState(false);

  // ── Recording infrastructure ────────────────────────────────────────────────
  const MAX_RECORDING_SECS = 300; // 5 minutes max recording
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recordingSecs,     setRecordingSecs]     = useState(0);
  const [transcriptionLang, setTranscriptionLang] = useState("en-IN");
  const [voiceProcessing,   setVoiceProcessing]   = useState(false);
  const [voiceError,        setVoiceError]        = useState("");
  const [voiceDone,         setVoiceDone]         = useState(false);

  const fmtSecs = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [soapTab, setSoapTab] = useState("soap");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState("");

  // Edit consultation state
  const [editModal, setEditModal] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [editSoapNote, setEditSoapNote] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [editMedicines, setEditMedicines] = useState<MedRow[]>([]);
  const [editIcd10, setEditIcd10] = useState<{ code: string; desc: string }[]>([]);
  const [editVitals, setEditVitals] = useState({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);
  const [loadingConsultation, setLoadingConsultation] = useState(false);

  // Patient timeline state (for My Patients tab)
  const [viewingPatientId, setViewingPatientId] = useState<string | null>(null);
  const [patientHistory, setPatientHistory] = useState<{ records: any[]; prescriptions: any[] } | null>(null);
  const [loadingPatientHistory, setLoadingPatientHistory] = useState(false);

  const loadPatientTimeline = useCallback(async (patientId: string) => {
    if (viewingPatientId === patientId) {
      setViewingPatientId(null);
      setPatientHistory(null);
      return;
    }
    if (!accessToken) return;
    setViewingPatientId(patientId);
    setPatientHistory(null);
    setLoadingPatientHistory(true);
    try {
      const res = await doctorApi.getPatientHistory(accessToken, patientId);
      setPatientHistory(res.data || null);
    } catch {
      setPatientHistory(null);
    } finally {
      setLoadingPatientHistory(false);
    }
  }, [viewingPatientId, accessToken]);

  const closeSession = useCallback(() => {
    setScannedPatientData(null);
    setCurrentSessionId(null);
    setCurrentPrescriptionId(null);
    setFinalizeSuccess(false);
    setFinalizeError("");
    setUpdateSuccess(false);
    setUpdateError("");
    setDraftSaved(false);
    setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
    setMedicines([]);
    setIcd10Codes([]);
    setVitals({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });
    setSoapTab("soap");
  }, []);

  // QR scanner state
  const [showScannerUI, setShowScannerUI] = useState(false); // controls whether the scanner div is in the DOM
  const [scannerActive, setScannerActive] = useState(false); // true once camera stream is live
  const [scannedPatientData, setScannedPatientData] = useState<ScannedPatient | null>(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [scannedPatients, setScannedPatients] = useState<ScannedPatient[]>([]);
  const [scanError, setScanError] = useState("");
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  // Use a ref for the success callback to avoid stale closure issues inside the scanner
  const onSuccessRef = useRef<(text: string) => void>(() => {});

  const stopScanner = useCallback(async () => {
    setShowScannerUI(false);
    setScannerActive(false);
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch (_) { /* ignore */ }
      html5QrRef.current = null;
    }
  }, []);

  // Keep the success handler up-to-date in the ref
  onSuccessRef.current = async (decodedText: string) => {
    await stopScanner();

    // New QR format: a URL like https://…/emergency/:patientId (24-char Mongo ObjectId)
    const urlMatch = decodedText.match(/\/emergency\/([a-f\d]{24})/i);
    if (urlMatch) {
      try {
        const res = await publicApi.getPatientEmergencyInfo(urlMatch[1]);
        const p = res.data;
        const data: ScannedPatient = {
          id: p._id || p.id,
          name: p.name,
          phone: p.phoneNumber || p.phone,
          dob: p.dob,
          gender: p.gender,
          bloodGroup: p.bloodGroup,
          languages: p.languagesKnown || p.languages || [],
          allergies: p.allergies || [],
          conditions: p.conditions || [],
          addedAt: new Date().toLocaleString(),
        };
        setScannedPatientData(data);
        setShowPatientModal(true);
        setScanError("");
      } catch {
        setScanError("Could not load patient data from QR. Please try again.");
      }
      return;
    }

    // Legacy JSON format (backwards compat)
    try {
      const data: ScannedPatient = JSON.parse(decodedText);
      data.addedAt = new Date().toLocaleString();
      setScannedPatientData(data);
      setShowPatientModal(true);
      setScanError("");
    } catch {
      setScanError("Invalid QR code. Please scan a valid patient QR.");
    }
  };

  // Once the scanner div is rendered into the DOM, start the camera
  useEffect(() => {
    if (!showScannerUI) return;
    let cancelled = false;
    const run = async () => {
      try {
        const scanner = new Html5Qrcode("doctor-qr-scanner");
        html5QrRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => onSuccessRef.current(text),
          undefined
        );
        if (!cancelled) setScannerActive(true);
      } catch (err: any) {
        if (!cancelled) {
          setScanError(err?.message || "Camera access denied. Please allow camera access and retry.");
          setShowScannerUI(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [showScannerUI]);

  const startScanner = useCallback(() => {
    setScanError("");
    setShowScannerUI(true);
  }, []);

  // cleanup on unmount
  useEffect(() => () => { stopScanner(); }, []);

  const confirmPatient = useCallback(async () => {
    if (!scannedPatientData) return;

    // Add to scanned list (no navigation)
    const alreadyAdded = scannedPatients.some((p) => p.id === scannedPatientData.id && p.phone === scannedPatientData.phone);
    if (!alreadyAdded) {
      setScannedPatients((prev) => [scannedPatientData, ...prev]);
    }

    // Always clear consultation tabs before starting a new session (fresh start)
    setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
    setMedicines([]);
    setIcd10Codes([]);
    setVitals({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });

    // ── Create/resume session in DB ────────────────────────────────────────
    try {
      const res = await doctorApi.scanPatient(
        accessToken!,
        scannedPatientData.id,
        scannedPatientData.phone
      );
      setCurrentSessionId(res.data.session._id);
      setCurrentPrescriptionId(null); // reset any prior prescription
      setFinalizeSuccess(false);
      setUpdateSuccess(false);
      setDraftSaved(false);
      // Always clear consultation tabs first (new patient = fresh start)
      setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
      setMedicines([]);
      setIcd10Codes([]);
      setVitals({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });
      // If the session has a saved draft, restore it
      const draft = res.data.session.draftData;
      if (draft) {
        if (draft.soapNote) setSoapNote({ subjective: draft.soapNote.subjective || "", objective: draft.soapNote.objective || "", assessment: draft.soapNote.assessment || "", plan: draft.soapNote.plan || "" });
        if (draft.medicines) setMedicines(draft.medicines);
        if (draft.icd10Codes) setIcd10Codes(draft.icd10Codes);
        if (draft.vitals) setVitals({ bp: draft.vitals.bp || "", hr: draft.vitals.hr != null ? String(draft.vitals.hr) : "", temperature: draft.vitals.temperature != null ? String(draft.vitals.temperature) : "", spO2: draft.vitals.spO2 != null ? String(draft.vitals.spO2) : "", weight: draft.vitals.weight != null ? String(draft.vitals.weight) : "", height: draft.vitals.height != null ? String(draft.vitals.height) : "", sugar: draft.vitals.sugar != null ? String(draft.vitals.sugar) : "", pr: draft.vitals.pr != null ? String(draft.vitals.pr) : "" });
      }
    } catch (err: any) {
      console.error("Failed to create session:", err);
      // Non-blocking: still allow local consultation even if DB call fails
    }

    // Derived info (age only, no prepopulation of consultation tabs)
    const dobParts = (scannedPatientData.dob || "").split("-");
    const birthYear = dobParts.length === 3 ? parseInt(dobParts[2]) : NaN;
    const _age = !isNaN(birthYear) ? `${new Date().getFullYear() - birthYear} years` : "";
    void _age; // available for future use

    setFinalizeSuccess(false);
    setFinalizeError("");
    setShowPatientModal(false);
  }, [scannedPatientData, scannedPatients, accessToken]);

  const [soapNote, setSoapNote] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });

  const [medicines, setMedicines] = useState<MedRow[]>([]);
  const [icd10Codes, setIcd10Codes] = useState<{ code: string; desc: string }[]>([]);
  const [vitals, setVitals] = useState({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });

  // ── Start real audio recording ───────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setVoiceError("");
    setVoiceDone(false);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());
      // Use recorder.start() without timeslice to avoid browser chunk-flushing bugs
      // that can silently stop data capture after ~20 seconds on some browsers.
      recorder.start();
      setRecording(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);

      // Auto-stop after MAX_RECORDING_SECS
      autoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          // Trigger the existing stop-and-process flow
          stopAndProcess();
        }
      }, MAX_RECORDING_SECS * 1000);
    } catch (err: any) {
      const isDenied = err?.name === "NotAllowedError" || err?.message?.toLowerCase().includes("permission");
      setVoiceError(
        isDenied
          ? "Microphone access denied. Please allow microphone access in your browser and try again."
          : `Could not access microphone: ${err?.message || "Unknown error"}`
      );
    }
  }, []);

  // ── Stop recording and run AI pipeline ──────────────────────────────────────
  const stopAndProcess = useCallback(async () => {
    // Stop timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    // Clear auto-stop timeout
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    setRecording(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setVoiceError("No active recording found. Please start recording first.");
      return;
    }

    // Wait for recorder.stop() to flush remaining chunks via ondataavailable
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    if (audioChunksRef.current.length === 0) {
      setVoiceError("No audio was captured. Please try again.");
      return;
    }
    if (!currentSessionId || !accessToken) {
      setVoiceError("No active session. Please scan a patient QR code first.");
      return;
    }

    const mimeType = recorder.mimeType || "audio/webm";
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

    setVoiceProcessing(true);
    setVoiceError("");
    setVoiceDone(false);

    try {
      const form = new FormData();
      form.append("audio", audioBlob, "recording.webm");
      form.append("sessionId", currentSessionId);
      form.append("language_code", transcriptionLang);

      const res = await doctorApi.processVoice(accessToken, form);
      const d = res.data;

      // Populate SOAP note
      if (d.soap) {
        setSoapNote({
          subjective: d.soap.subjective || "",
          objective:  d.soap.objective  || "",
          assessment: d.soap.assessment || "",
          plan:       d.soap.plan       || "",
        });
      }

      // Populate vitals
      if (d.vitals) {
        setVitals({
          bp:          d.vitals.bp          != null ? String(d.vitals.bp)          : "",
          hr:          d.vitals.hr          != null ? String(d.vitals.hr)          : "",
          temperature: d.vitals.temperature != null ? String(d.vitals.temperature) : "",
          spO2:        d.vitals.spO2        != null ? String(d.vitals.spO2)        : "",
          weight:      d.vitals.weight      != null ? String(d.vitals.weight)      : "",
          height:      d.vitals.height      != null ? String(d.vitals.height)      : "",
          sugar:       d.vitals.sugar       != null ? String(d.vitals.sugar)       : "",
          pr:          d.vitals.pr          != null ? String(d.vitals.pr)          : "",
        });
      }

      // Populate ICD-10 codes
      if (Array.isArray(d.icd_codes)) {
        setIcd10Codes(
          d.icd_codes.map((c: any) => ({ code: c.code, desc: c.description || c.desc || "" }))
        );
      }

      // Map AI prescription shape → MedRow shape used by the dashboard
      if (Array.isArray(d.prescription)) {
        setMedicines(
          d.prescription.map((p: any) => {
            const timing: string[] = Array.isArray(p.timing) ? p.timing : [];
            return {
              name:      p.name   || "",
              dosage:    p.dosage || "",
              frequency: timing.length > 0 ? timing.join(", ") : "As directed",
              duration:  p.durationDays ? `${p.durationDays} days` : "",
              morning:   timing.some((t: string) => t.startsWith("morning")),
              afternoon: timing.some((t: string) => t.startsWith("afternoon")),
              night:     timing.some((t: string) => t.startsWith("night")),
              bedtime:   timing.includes("sos"),
            };
          })
        );
      }

      setVoiceDone(true);
      setSoapTab("soap"); // auto-switch to SOAP tab so doctor sees the result
    } catch (err: any) {
      setVoiceError(err?.message || "Voice pipeline failed. Please try again.");
    } finally {
      setVoiceProcessing(false);
    }
  }, [accessToken, currentSessionId, transcriptionLang, setSoapNote, setVitals, setIcd10Codes, setMedicines, setSoapTab]);

  // Cleanup recording resources on unmount
  useEffect(() => () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Open edit modal for a completed session
  const openEditModal = useCallback(async (sessionId: string) => {
    if (!accessToken) return;
    setEditError("");
    setEditSuccess(false);
    setLoadingConsultation(true);
    setEditModal(true);
    try {
      const res = await doctorApi.getConsultation(accessToken, sessionId);
      const { prescription } = res.data;
      if (prescription) {
        setEditingPrescriptionId(prescription._id);
        const d = prescription.data || {};
        setEditSoapNote({
          subjective: d.soapNote?.subjective || "",
          objective: d.soapNote?.objective || "",
          assessment: d.soapNote?.assessment || "",
          plan: d.soapNote?.plan || "",
        });
        setEditMedicines(d.consultationMedicines || []);
        setEditIcd10(d.icd10Codes || []);
        setEditVitals({
          bp: d.vitals?.bp || "",
          hr: d.vitals?.hr != null ? String(d.vitals.hr) : "",
          temperature: d.vitals?.temperature != null ? String(d.vitals.temperature) : "",
          spO2: d.vitals?.spO2 != null ? String(d.vitals.spO2) : "",
          weight: d.vitals?.weight != null ? String(d.vitals.weight) : "",
          height: d.vitals?.height != null ? String(d.vitals.height) : "",
          sugar: d.vitals?.sugar != null ? String(d.vitals.sugar) : "",
          pr: d.vitals?.pr != null ? String(d.vitals.pr) : "",
        });
        setEditHistory(d.editHistory || []);
      } else {
        setEditError("No consultation data found for this session.");
      }
    } catch {
      setEditError("Failed to load consultation data.");
    } finally {
      setLoadingConsultation(false);
    }
  }, [accessToken]);

  // Submit edit
  const submitEdit = useCallback(async () => {
    if (!editingPrescriptionId || !accessToken) return;
    setEditSaving(true);
    setEditError("");
    try {
      await doctorApi.editConsultation(
        accessToken,
        editingPrescriptionId,
        editSoapNote,
        editMedicines,
        editIcd10,
        {
          bp: editVitals.bp || null,
          hr: editVitals.hr ? Number(editVitals.hr) : null,
          temperature: editVitals.temperature ? Number(editVitals.temperature) : null,
          spO2: editVitals.spO2 ? Number(editVitals.spO2) : null,
          weight: editVitals.weight ? Number(editVitals.weight) : null,
          height: editVitals.height ? Number(editVitals.height) : null,
          sugar: editVitals.sugar ? Number(editVitals.sugar) : null,
          pr: editVitals.pr ? Number(editVitals.pr) : null,
        },
        editNote
      );
      setEditSuccess(true);
      setEditNote("");
    } catch (err: any) {
      setEditError(err.message || "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  }, [accessToken, editingPrescriptionId, editSoapNote, editMedicines, editIcd10, editVitals, editNote]);

  // Live data state
  const [doctor, setDoctor] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [draftSessions, setDraftSessions] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [consultHistoryData, setConsultHistoryData] = useState<{ records: any[]; prescriptions: any[] } | null>(null);
  const [consultHistoryLoading, setConsultHistoryLoading] = useState(false);
  const [consultHistoryPage, setConsultHistoryPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // Helper to refresh draft sessions list from backend
  const refreshDrafts = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await doctorApi.getDraftSessions(accessToken);
      setDraftSessions(res.data || []);
    } catch { /* silent */ }
  }, [accessToken]);

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) return;
      setLoading(true);
      try {
        const [profileRes, sessionsRes, patientsRes, draftRes] = await Promise.all([
          doctorApi.getProfile(accessToken).catch(() => ({ data: user })),
          doctorApi.getSessions(accessToken).catch(() => ({ data: [] })),
          doctorApi.getPatients(accessToken).catch(() => ({ data: [] })),
          doctorApi.getDraftSessions(accessToken).catch(() => ({ data: [] })),
        ]);
        setDoctor(profileRes.data || user);
        setEditLanguages(profileRes.data?.languagesKnown || []);
        setSessions(sessionsRes.data || []);
        setPatients(patientsRes.data || []);
        setDraftSessions(draftRes.data || []);
      } catch (err) {
        console.error("Failed to fetch doctor data:", err);
        setDoctor(user);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [accessToken]);

  // Refresh drafts whenever the user switches to the drafts or overview tab
  useEffect(() => {
    if (tab === "drafts" || tab === "overview") {
      refreshDrafts();
    }
  }, [tab, refreshDrafts]);

  // Reset consultation history when scanned patient changes
  useEffect(() => {
    setConsultHistoryData(null);
    setConsultHistoryPage(0);
    setConsultHistoryLoading(false);
  }, [scannedPatientData?.id]);

  // Fetch consultation history when history tab is opened
  useEffect(() => {
    if (soapTab !== "history") return;
    if (!accessToken) return;
    const patId = scannedPatientData?.id;
    if (!patId) return;
    if (consultHistoryData !== null || consultHistoryLoading) return;
    setConsultHistoryLoading(true);
    doctorApi.getPatientHistory(accessToken, patId)
      .then((r) => { setConsultHistoryData(r.data || null); setConsultHistoryPage(0); })
      .catch(() => setConsultHistoryData(null))
      .finally(() => setConsultHistoryLoading(false));
  }, [soapTab, scannedPatientData, consultHistoryData, consultHistoryLoading, accessToken]);

  const doctorName = doctor?.name || user?.name || "Doctor";
  const doctorSpecialization = doctor?.specialization || "";
  const doctorAvatar = doctorName.charAt(0).toUpperCase();

  const consultPatient = scannedPatientData;

  const tabTitles: Record<string, string> = {
    overview: "Dashboard",
    sessions: "My Sessions",
    drafts: "Draft Sessions",
    patients: "Patients",
    consultation: "New Consultation",
    prescriptions: "Prescriptions",
    labs: "Lab Reports",
    settings: "Settings",
  };

  if (loading) {
    return (
      <DashboardLayout title="My Dashboard" links={links} userName={doctorName} userSubtitle={doctorSpecialization} userAvatar={doctorAvatar}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
    {/* Edit Consultation Modal */}
    {editModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl my-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-heading font-bold text-foreground">Edit Consultation</h2>
            <button onClick={() => { setEditModal(false); setEditSuccess(false); setEditError(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          {loadingConsultation ? (
            <div className="flex items-center justify-center py-16"><RefreshCw className="w-7 h-7 animate-spin text-primary" /></div>
          ) : (
            <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">

              {/* Change note */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Reason for edit (will be stored in history)</label>
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* SOAP Note */}
              <div>
                <p className="text-sm font-heading font-bold mb-3">SOAP Note</p>
                <div className="space-y-3">
                  {(["subjective", "objective", "assessment", "plan"] as const).map((key) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground capitalize block mb-1">{key}</label>
                      <textarea
                        rows={2}
                        value={editSoapNote[key]}
                        onChange={(e) => setEditSoapNote((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Vitals */}
              <div>
                <p className="text-sm font-heading font-bold mb-3">Vitals</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "bp", label: "Blood Pressure", placeholder: "120/80 mmHg" },
                    { key: "hr", label: "Heart Rate (bpm)", placeholder: "72" },
                    { key: "temperature", label: "Temperature (\u00b0F)", placeholder: "98.6" },
                    { key: "spO2", label: "SpO\u2082 (%)", placeholder: "98" },
                    { key: "weight", label: "Weight (kg)", placeholder: "70" },
                    { key: "height", label: "Height (cm)", placeholder: "170" },
                    { key: "sugar", label: "Blood Sugar (mg/dL)", placeholder: "90" },
                    { key: "pr", label: "Pulse Rate (bpm)", placeholder: "72" },
                  ] as { key: keyof typeof editVitals; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                      <input value={editVitals[key]} placeholder={placeholder} onChange={(e) => setEditVitals((p) => ({ ...p, [key]: e.target.value }))} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Medicines / Prescription */}
              <div>
                <p className="text-sm font-heading font-bold mb-3">Prescription</p>
                <table className="w-full text-xs mb-2">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-1.5">Medicine</th>
                      <th className="pb-1.5">Dosage</th>
                      <th className="pb-1.5">Frequency</th>
                      <th className="pb-1.5">Duration</th>
                      <th className="pb-1.5">M</th>
                      <th className="pb-1.5">A</th>
                      <th className="pb-1.5">N</th>
                      <th className="pb-1.5">B</th>
                      <th className="pb-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editMedicines.map((m, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-1 pr-1"><input value={m.name} onChange={(e) => { const u=[...editMedicines]; u[i]={...u[i],name:e.target.value}; setEditMedicines(u); }} className="w-full bg-transparent border-b border-input text-foreground focus:outline-none focus:border-primary px-1" /></td>
                        <td className="py-1 pr-1"><input value={m.dosage} onChange={(e) => { const u=[...editMedicines]; u[i]={...u[i],dosage:e.target.value}; setEditMedicines(u); }} className="w-full bg-transparent border-b border-input text-muted-foreground focus:outline-none focus:border-primary px-1" /></td>
                        <td className="py-1 pr-1"><input value={m.frequency} onChange={(e) => { const u=[...editMedicines]; u[i]={...u[i],frequency:e.target.value}; setEditMedicines(u); }} className="w-full bg-transparent border-b border-input text-muted-foreground focus:outline-none focus:border-primary px-1" /></td>
                        <td className="py-1 pr-1"><input value={m.duration} onChange={(e) => { const u=[...editMedicines]; u[i]={...u[i],duration:e.target.value}; setEditMedicines(u); }} className="w-full bg-transparent border-b border-input text-muted-foreground focus:outline-none focus:border-primary px-1" /></td>
                        {(["morning", "afternoon", "night", "bedtime"] as const).map((t) => (
                          <td key={t} className="py-1"><input type="checkbox" checked={m[t]} onChange={() => { const u=[...editMedicines]; u[i]={...u[i],[t]:!u[i][t]}; setEditMedicines(u); }} className="accent-primary" /></td>
                        ))}
                        <td className="py-1"><button onClick={() => setEditMedicines(editMedicines.filter((_, idx) => idx !== i))} className="text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => setEditMedicines([...editMedicines, { name: "", dosage: "", frequency: "", duration: "", morning: false, afternoon: false, night: false, bedtime: false }])} className="flex items-center gap-1.5 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add Medicine</button>
              </div>

              {/* ICD-10 */}
              <div>
                <p className="text-sm font-heading font-bold mb-3">ICD-10 Codes</p>
                <div className="space-y-2">
                  {editIcd10.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={c.code} onChange={(e) => { const u=[...editIcd10]; u[i]={...u[i],code:e.target.value}; setEditIcd10(u); }} className="w-24 px-2 py-1.5 border border-input rounded-md text-xs font-mono text-primary bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                      <input value={c.desc} onChange={(e) => { const u=[...editIcd10]; u[i]={...u[i],desc:e.target.value}; setEditIcd10(u); }} className="flex-1 px-2 py-1.5 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                      <button onClick={() => setEditIcd10(editIcd10.filter((_, idx) => idx !== i))} className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditIcd10([...editIcd10, { code: "", desc: "" }])} className="flex items-center gap-1.5 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add Code</button>
                </div>
              </div>

              {/* Edit History */}
              {editHistory.length > 0 && (
                <div>
                  <p className="text-sm font-heading font-bold mb-3">Edit History ({editHistory.length})</p>
                  <div className="space-y-2">
                    {[...editHistory].reverse().map((h, i) => (
                      <details key={i} className="border border-border rounded-md text-sm">
                        <summary className="px-3 py-2 cursor-pointer text-muted-foreground text-xs flex justify-between">
                          <span>{h.editNote || "No note"}</span>
                          <span>{new Date(h.editedAt).toLocaleString()}</span>
                        </summary>
                        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-1 border-t border-border">
                          {h.snapshot?.soapNote?.assessment && <p><span className="font-medium text-foreground">Assessment:</span> {h.snapshot.soapNote.assessment}</p>}
                          {h.snapshot?.vitals?.bp && <p><span className="font-medium text-foreground">BP:</span> {h.snapshot.vitals.bp}</p>}
                          {(h.snapshot?.icd10Codes || []).length > 0 && <p><span className="font-medium text-foreground">ICD-10:</span> {h.snapshot.icd10Codes.map((c: any) => c.code).join(", ")}</p>}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors / success */}
              {editError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{editError}
                </div>
              )}
              {editSuccess && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />Changes saved! Previous version is preserved in history.
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button onClick={() => { setEditModal(false); setEditSuccess(false); }} className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground">
              {editSuccess ? "Close" : "Cancel"}
            </button>
            {!editSuccess && (
              <button
                onClick={submitEdit}
                disabled={editSaving || !editingPrescriptionId}
                className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50 flex items-center gap-2"
              >
                {editSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Patient details modal */}
    {showPatientModal && scannedPatientData && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              <h2 className="text-base font-heading font-bold text-foreground">QR Scanned Successfully</h2>
            </div>
            <button onClick={() => setShowPatientModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-4 space-y-3 text-sm">
            {([
              ["Name", scannedPatientData.name],
              ["Phone", scannedPatientData.phone],
              ["Date of Birth", formatDOB(scannedPatientData.dob)],
              ["Gender", scannedPatientData.gender],
              ["Blood Group", scannedPatientData.bloodGroup],
              ["Languages", (scannedPatientData.languages || []).join(", ") || "—"],
              ["Allergies", (scannedPatientData.allergies || []).join(", ") || "None"],
              ["Conditions", (scannedPatientData.conditions || []).join(", ") || "None"],
            ] as [string, string | undefined][]).map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-medium text-right max-w-[55%]">{value || "—"}</span>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 bg-accent/20 rounded-b-xl text-xs text-muted-foreground text-center border-t border-border">
            Confirming will pre-populate SOAP notes, prescription and ICD-10 codes based on this patient's profile.
          </div>
          <div className="px-6 py-4 flex gap-3 border-t border-border">
            <button onClick={() => setShowPatientModal(false)} className="flex-1 px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={confirmPatient} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md">
              <CheckCircle className="w-4 h-4" /> Confirm &amp; Start Consultation
            </button>
          </div>
        </div>
      </div>
    )}
    <DashboardLayout title={tabTitles[tab] || "Dashboard"} links={links} userName={doctorName} userSubtitle={doctorSpecialization} userAvatar={doctorAvatar}>
      {/* Tabs are in the sidebar */}

      {tab === "overview" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-heading font-bold text-foreground">Good morning, {doctorName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={CalendarDays} label="Today's Sessions" value={sessions.filter((s) => s.status === "scheduled" || s.status === "ongoing").length} tint="primary" />
            <StatCard icon={ClipboardList} label="Pending Notes" value={sessions.filter((s) => s.status === "ongoing").length} tint="accent" />
            <StatCard icon={Users} label="Active Patients" value={patients.length} tint="primary" />
            <StatCard icon={FileText} label="Lab Reports Awaiting" value={0} tint="destructive" />
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title="Saved Draft Sessions" />
            <div className="space-y-3">
              {draftSessions.slice(0, 5).map((s) => (
                <div key={s._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.patientId?.name || "Patient"}</p>
                    <p className="text-xs text-muted-foreground">{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ""} — Draft in progress</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={s.status} />
                    <button
                      onClick={() => {
                        const draft = s.draftData;
                        const pat = s.patientId;
                        setScannedPatientData({
                          id: pat?._id || pat?.id,
                          name: pat?.name,
                          phone: pat?.phoneNumber || pat?.phone,
                          dob: pat?.dob,
                          gender: pat?.gender,
                          bloodGroup: pat?.bloodGroup,
                          languages: pat?.languagesKnown || pat?.languages,
                          allergies: pat?.allergies,
                          conditions: pat?.conditions,
                        });
                        setCurrentSessionId(s._id);
                        setCurrentPrescriptionId(null);
                        setFinalizeSuccess(false); setFinalizeError(""); setUpdateSuccess(false); setDraftSaved(false);
                        setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
                        setMedicines([]); setIcd10Codes([]);
                        setVitals({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });
                        if (draft) {
                          if (draft.soapNote) setSoapNote({ subjective: draft.soapNote.subjective || "", objective: draft.soapNote.objective || "", assessment: draft.soapNote.assessment || "", plan: draft.soapNote.plan || "" });
                          if (draft.medicines) setMedicines(draft.medicines);
                          if (draft.icd10Codes) setIcd10Codes(draft.icd10Codes);
                          if (draft.vitals) setVitals({ bp: draft.vitals.bp || "", hr: draft.vitals.hr != null ? String(draft.vitals.hr) : "", temperature: draft.vitals.temperature != null ? String(draft.vitals.temperature) : "", spO2: draft.vitals.spO2 != null ? String(draft.vitals.spO2) : "", weight: draft.vitals.weight != null ? String(draft.vitals.weight) : "", height: draft.vitals.height != null ? String(draft.vitals.height) : "", sugar: draft.vitals.sugar != null ? String(draft.vitals.sugar) : "", pr: draft.vitals.pr != null ? String(draft.vitals.pr) : "" });
                        }
                        setTab("consultation");
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-foreground gradient-primary rounded-md"
                    >
                      Open Draft <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {draftSessions.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No saved drafts.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="My Sessions" />
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">ID</th><th className="pb-2">Patient</th><th className="pb-2">Date & Time</th><th className="pb-2">Status</th><th className="pb-2"></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id} className="border-b border-border last:border-0 zebra-row">
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{s.sessionId || s._id}</td>
                  <td className="py-2.5 text-foreground font-medium">{s.patientId?.name || "Patient"}</td>
                  <td className="py-2.5 text-muted-foreground">{s.startTimestamp ? new Date(s.startTimestamp).toLocaleString() : "—"}</td>
                  <td className="py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="py-2.5">
                    {s.status === "completed" && (
                      <button
                        onClick={() => openEditModal(s._id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary border border-primary rounded-md hover:bg-primary/10"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">No sessions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "patients" && (
        <div className="space-y-6">
          {scannedPatients.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6 shadow-card">
              <SectionHeader title="Scanned via QR" action={<span className="text-xs text-muted-foreground">{scannedPatients.length} patient{scannedPatients.length !== 1 ? "s" : ""}</span>} />
              <div className="space-y-3">
                {scannedPatients.map((p, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{p.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.gender}{p.dob ? ` · DOB: ${formatDOB(p.dob)}` : ""} · {p.bloodGroup || "—"}
                          {(p.conditions || []).length > 0 ? ` · ${p.conditions!.join(", ")}` : ""}
                        </p>
                        {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setScannedPatientData(p); setShowPatientModal(true); }} className="text-xs text-primary underline">View</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="My Patients" action={<div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search by name or ID…" className="pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" /></div>} />
          {patients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No patients found.</p>
          ) : (
          <div className="space-y-4">
            {patients.filter((p) => !patientSearch.trim() || p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || (p.patientId || "").toLowerCase().includes(patientSearch.toLowerCase())).map((p) => (
              <div key={p._id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.bloodGroup} · {p.phoneNumber || p.phone || ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadPatientTimeline(p._id)}
                      className="flex items-center gap-1.5 text-xs text-primary border border-primary/40 rounded-md px-2.5 py-1.5 hover:bg-primary/5 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      {viewingPatientId === p._id ? "Hide History" : "View History"}
                    </button>
                  </div>
                </div>

                {/* Timeline panel for this patient */}
                {viewingPatientId === p._id && (
                  <div className="mt-3 border-t border-border pt-3">
                    {loadingPatientHistory ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading history…
                      </div>
                    ) : !patientHistory || (patientHistory.records.length === 0 && patientHistory.prescriptions.length === 0) ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">No consultation history found for this patient.</p>
                    ) : (
                      <PatientTimeline records={patientHistory.records} prescriptions={patientHistory.prescriptions} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
      )}

      {tab === "drafts" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader
              title="Draft Sessions"
              action={
                <span className="text-xs text-muted-foreground">
                  {draftSessions.length} draft{draftSessions.length !== 1 ? "s" : ""}
                </span>
              }
            />
            {draftSessions.length === 0 ? (
              <div className="py-12 text-center">
                <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No saved drafts. Drafts are created when you save a consultation in progress.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {draftSessions.map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-3.5 px-4 border border-border rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{s.patientId?.name || "Patient"}</p>
                      <p className="text-xs text-muted-foreground">
                        Last saved:{" "}
                        {s.updatedAt
                          ? new Date(s.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </p>
                      {s.draftData?.soapNote?.assessment && (
                        <p className="text-xs text-muted-foreground italic truncate max-w-xs">
                          Assessment: {s.draftData.soapNote.assessment}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={s.status} />
                      <button
                        onClick={() => {
                          const draft = s.draftData;
                          const pat = s.patientId;
                          setScannedPatientData({
                            id: pat?._id || pat?.id,
                            name: pat?.name,
                            phone: pat?.phoneNumber || pat?.phone,
                            dob: pat?.dob,
                            gender: pat?.gender,
                            bloodGroup: pat?.bloodGroup,
                            languages: pat?.languagesKnown || pat?.languages,
                            allergies: pat?.allergies,
                            conditions: pat?.conditions,
                          });
                          setCurrentSessionId(s._id);
                          setCurrentPrescriptionId(null);
                          setFinalizeSuccess(false); setFinalizeError(""); setUpdateSuccess(false); setDraftSaved(false);
                          setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
                          setMedicines([]); setIcd10Codes([]);
                          setVitals({ bp: "", hr: "", temperature: "", spO2: "", weight: "", height: "", sugar: "", pr: "" });
                          if (draft) {
                            if (draft.soapNote) setSoapNote({ subjective: draft.soapNote.subjective || "", objective: draft.soapNote.objective || "", assessment: draft.soapNote.assessment || "", plan: draft.soapNote.plan || "" });
                            if (draft.medicines) setMedicines(draft.medicines);
                            if (draft.icd10Codes) setIcd10Codes(draft.icd10Codes);
                            if (draft.vitals) setVitals({ bp: draft.vitals.bp || "", hr: draft.vitals.hr != null ? String(draft.vitals.hr) : "", temperature: draft.vitals.temperature != null ? String(draft.vitals.temperature) : "", spO2: draft.vitals.spO2 != null ? String(draft.vitals.spO2) : "", weight: draft.vitals.weight != null ? String(draft.vitals.weight) : "", height: draft.vitals.height != null ? String(draft.vitals.height) : "", sugar: draft.vitals.sugar != null ? String(draft.vitals.sugar) : "", pr: draft.vitals.pr != null ? String(draft.vitals.pr) : "" });
                          }
                          setTab("consultation");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground gradient-primary rounded-md"
                      >
                        Resume <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "consultation" && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: QR Scanner */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-lg p-4 shadow-card">
              <SectionHeader title="Scan Patient QR" />
              <p className="text-xs text-muted-foreground mb-4">Ask the patient to show their Emergency QR code, then scan it here to load their details.</p>

              {/* Camera feed — only rendered when scanner is open so html5-qrcode
                  finds a visible, sized element in the DOM */}
              {showScannerUI && (
                <div>
                  <div id="doctor-qr-scanner" className="rounded-lg overflow-hidden mb-3 w-full" />
                  <button
                    onClick={stopScanner}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-destructive text-destructive-foreground rounded-md mb-4"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              )}

              {!showScannerUI && (
                <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-border rounded-lg mb-4">
                  <QrCode className="w-12 h-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{consultPatient ? consultPatient.name : "No patient scanned yet"}</p>
                  <button onClick={startScanner} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md">
                    <Camera className="w-4 h-4" /> {consultPatient ? "Scan New Patient" : "Scan QR Code"}
                  </button>
                </div>
              )}

              {scanError && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-xs text-destructive mb-4">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{scanError}
                </div>
              )}

              {consultPatient && (
                <div className="bg-secondary rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-foreground">{consultPatient.name}</p>
                    <button onClick={() => setShowPatientModal(true)} className="text-xs text-primary underline">Full Details</button>
                  </div>
                  <p className="text-muted-foreground">{consultPatient.gender}{consultPatient.dob ? ` · DOB: ${formatDOB(consultPatient.dob)}` : ""} · {consultPatient.bloodGroup || "—"}</p>
                  {(consultPatient.conditions || []).length > 0 && <p className="text-muted-foreground">Conditions: {consultPatient.conditions!.join(", ")}</p>}
                  {(consultPatient.allergies || []).length > 0 && <p className="text-destructive text-xs">⚠ Allergies: {consultPatient.allergies!.join(", ")}</p>}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-4 shadow-card">
              <SectionHeader title="Session Controls" />

              {/* Language selector */}
              <div className="mb-3">
                <label className="text-xs text-muted-foreground block mb-1">Transcription Language</label>
                <select
                  value={transcriptionLang}
                  onChange={(e) => setTranscriptionLang(e.target.value)}
                  disabled={recording || voiceProcessing}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="te-IN">Telugu</option>
                </select>
              </div>

              {/* Record / Stop button */}
              <button
                onClick={recording ? stopAndProcess : startRecording}
                disabled={voiceProcessing || !currentSessionId}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-opacity disabled:opacity-50 ${
                  recording
                    ? "bg-destructive text-destructive-foreground"
                    : "gradient-primary text-primary-foreground"
                }`}
              >
                {recording
                  ? <><MicOff className="w-5 h-5" /> Stop Recording</>
                  : <><Mic className="w-5 h-5" /> Start Recording</>}
              </button>

              {/* No session warning */}
              {!currentSessionId && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Scan a patient QR code to enable recording
                </p>
              )}

              {/* Live timer */}
              {recording && (
                <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  Recording — {fmtSecs(recordingSecs)} / {fmtSecs(MAX_RECORDING_SECS)}
                </div>
              )}

              {/* AI processing indicator */}
              {voiceProcessing && (
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing audio with AI…
                </div>
              )}

              {/* Error */}
              {voiceError && (
                <div className="flex items-start gap-2 mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded-md text-xs text-destructive">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {voiceError}
                </div>
              )}

              {/* Success */}
              {voiceDone && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-md text-xs text-green-700 dark:text-green-400">
                  <CheckCircle className="w-3 h-3 shrink-0" />
                  SOAP note generated — review the tabs and finalize.
                </div>
              )}
            </div>
          </div>

          {/* Right: SOAP Note */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg shadow-card">
              <div className="flex border-b border-border overflow-x-auto">
                {["soap", "vitals", "prescription", "icd10", "history"].map((t) => (
                  <button key={t} onClick={() => setSoapTab(t)} className={`px-4 py-3 text-sm font-medium capitalize border-b-2 whitespace-nowrap ${soapTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
                    {t === "soap" ? "SOAP Note" : t === "icd10" ? "ICD-10 Codes" : t === "vitals" ? "Vitals" : t === "history" ? "History" : "Prescription"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {soapTab === "vitals" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Record patient vitals for this consultation. Leave fields blank if not measured.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {([
                        { key: "bp", label: "Blood Pressure", unit: "mmHg", type: "text" },
                        { key: "hr", label: "Heart Rate", unit: "bpm", type: "number" },
                        { key: "temperature", label: "Temperature", unit: "°F", type: "number" },
                        { key: "spO2", label: "SpO₂", unit: "%", type: "number" },
                        { key: "weight", label: "Weight", unit: "kg", type: "number" },
                        { key: "height", label: "Height", unit: "cm", type: "number" },
                        { key: "sugar", label: "Blood Sugar", unit: "mg/dL", type: "number" },
                        { key: "pr", label: "Pulse Rate", unit: "bpm", type: "number" },
                      ] as { key: keyof typeof vitals; label: string; unit: string; type: string }[]).map(({ key, label, unit, type }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                          <div className="flex items-center border border-input rounded-md overflow-hidden bg-background focus-within:ring-2 focus-within:ring-ring">
                            <input
                              type={type}
                              value={vitals[key]}
                              onChange={(e) => setVitals((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="flex-1 px-3 py-2 text-sm bg-transparent text-foreground focus:outline-none"
                            />
                            <span className="px-2 py-2 text-xs text-muted-foreground bg-muted border-l border-input shrink-0">{unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {soapTab === "history" && (() => {
                  const patId = consultPatient?.id;
                  if (!patId) {
                    return <p className="text-sm text-muted-foreground py-6 text-center">No patient selected. Scan a QR code first.</p>;
                  }
                  if (consultHistoryLoading) {
                    return (
                      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Loading history…
                      </div>
                    );
                  }
                  const prescriptions = consultHistoryData?.prescriptions || [];
                  if (prescriptions.length === 0) {
                    return <p className="text-sm text-muted-foreground py-6 text-center">No past consultations found for this patient.</p>;
                  }
                  const total = prescriptions.length;
                  const rx = prescriptions[consultHistoryPage];
                  // Prescription data is nested under rx.data (Prescription model)
                  const rxData = rx.data || rx;
                  return (
                    <div className="space-y-4">
                      {/* Pagination */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Consultation {consultHistoryPage + 1} of {total}</span>
                        <div className="flex gap-2">
                          <button disabled={consultHistoryPage === 0} onClick={() => setConsultHistoryPage((p) => p - 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">‹ Prev</button>
                          <button disabled={consultHistoryPage === total - 1} onClick={() => setConsultHistoryPage((p) => p + 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Next ›</button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{rx.createdAt ? new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</div>
                      {/* SOAP */}
                      {rxData.soapNote && (
                        <div className="space-y-2">
                          {(["subjective","objective","assessment","plan"] as const).map((k) => rxData.soapNote[k] ? (
                            <div key={k}>
                              <p className="text-xs font-semibold capitalize text-muted-foreground">{k}</p>
                              <p className="text-sm text-foreground">{rxData.soapNote[k]}</p>
                            </div>
                          ) : null)}
                        </div>
                      )}
                      {/* Vitals */}
                      {rxData.vitals && Object.values(rxData.vitals).some(Boolean) && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Vitals</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {rxData.vitals.bp && <span>BP: {rxData.vitals.bp} mmHg</span>}
                            {rxData.vitals.hr && <span>HR: {rxData.vitals.hr} bpm</span>}
                            {rxData.vitals.temperature && <span>Temp: {rxData.vitals.temperature}°F</span>}
                            {rxData.vitals.spO2 && <span>SpO₂: {rxData.vitals.spO2}%</span>}
                            {rxData.vitals.weight && <span>Wt: {rxData.vitals.weight} kg</span>}
                            {rxData.vitals.height && <span>Ht: {rxData.vitals.height} cm</span>}
                            {rxData.vitals.sugar && <span>Sugar: {rxData.vitals.sugar} mg/dL</span>}
                          </div>
                        </div>
                      )}
                      {/* Medicines */}
                      {(rxData.consultationMedicines || rxData.medicines || []).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Medicines</p>
                          <ul className="space-y-1 text-sm list-disc pl-4">
                            {(rxData.consultationMedicines || rxData.medicines).map((m: any, i: number) => (
                              <li key={i}>{m.name} {m.dosage} &mdash; {m.frequency}{m.duration ? `, ${m.duration}` : ""}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* ICD-10 */}
                      {(rxData.icd10Codes || []).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">ICD-10 Codes</p>
                          <div className="flex flex-wrap gap-2">
                            {rxData.icd10Codes.map((c: any, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-secondary text-xs rounded">{c.code} {c.desc}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {soapTab === "soap" && (
                  <div className="space-y-4">
                    {(["subjective", "objective", "assessment", "plan"] as const).map((section) => (
                      <div key={section}>
                        <label className="text-sm font-heading font-bold text-foreground capitalize mb-1.5 flex items-center gap-2">
                          <span className="w-6 h-6 rounded gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{section[0].toUpperCase()}</span>
                          {section}
                        </label>
                        <textarea
                          value={soapNote[section]}
                          onChange={(e) => setSoapNote((prev) => ({ ...prev, [section]: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2.5 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {soapTab === "prescription" && (
                  <div className="space-y-4">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="pb-2">Medicine</th><th className="pb-2">Dosage</th><th className="pb-2">Frequency</th><th className="pb-2">Duration</th><th className="pb-2">M</th><th className="pb-2">A</th><th className="pb-2">N</th><th className="pb-2">B</th><th className="pb-2"></th></tr></thead>
                      <tbody>
                        {medicines.map((m, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-1.5 pr-1"><input value={m.name} onChange={(e) => { const u=[...medicines]; u[i]={...u[i],name:e.target.value}; setMedicines(u); }} className="w-full bg-transparent border-b border-input text-sm text-foreground focus:outline-none focus:border-primary px-1" /></td>
                            <td className="py-1.5 pr-1"><input value={m.dosage} onChange={(e) => { const u=[...medicines]; u[i]={...u[i],dosage:e.target.value}; setMedicines(u); }} className="w-full bg-transparent border-b border-input text-sm text-muted-foreground focus:outline-none focus:border-primary px-1" /></td>
                            <td className="py-1.5 pr-1"><input value={m.frequency} onChange={(e) => { const u=[...medicines]; u[i]={...u[i],frequency:e.target.value}; setMedicines(u); }} className="w-full bg-transparent border-b border-input text-sm text-muted-foreground focus:outline-none focus:border-primary px-1" /></td>
                            <td className="py-1.5 pr-1"><input value={m.duration} onChange={(e) => { const u=[...medicines]; u[i]={...u[i],duration:e.target.value}; setMedicines(u); }} className="w-full bg-transparent border-b border-input text-sm text-muted-foreground focus:outline-none focus:border-primary px-1" /></td>
                            {(["morning", "afternoon", "night", "bedtime"] as const).map((t) => (
                              <td key={t} className="py-2">
                                <input type="checkbox" checked={m[t]} onChange={() => {
                                  const updated = [...medicines];
                                  updated[i] = { ...updated[i], [t]: !updated[i][t] };
                                  setMedicines(updated);
                                }} className="accent-primary" />
                              </td>
                            ))}
                            <td className="py-2"><button onClick={() => setMedicines(medicines.filter((_, idx) => idx !== i))} className="text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={() => setMedicines([...medicines, { name: "", dosage: "", frequency: "", duration: "", morning: false, afternoon: false, night: false, bedtime: false }])} className="flex items-center gap-1.5 text-sm text-primary font-medium"><Plus className="w-4 h-4" /> Add Medicine</button>
                  </div>
                )}

                {soapTab === "icd10" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      {icd10Codes.length > 0 ? "Auto-suggested from patient conditions — edit as needed:" : "No conditions detected. Add codes manually."}
                    </p>
                    {icd10Codes.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 py-2 px-3 bg-secondary rounded-md">
                        <input
                          value={c.code}
                          onChange={(e) => { const u=[...icd10Codes]; u[i]={...u[i],code:e.target.value}; setIcd10Codes(u); }}
                          className="w-20 font-mono text-xs text-primary font-medium bg-transparent border-b border-input focus:outline-none focus:border-primary px-1"
                        />
                        <input
                          value={c.desc}
                          onChange={(e) => { const u=[...icd10Codes]; u[i]={...u[i],desc:e.target.value}; setIcd10Codes(u); }}
                          className="flex-1 text-sm text-foreground bg-transparent border-b border-input focus:outline-none focus:border-primary px-1"
                        />
                        <button onClick={() => setIcd10Codes(icd10Codes.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <button
                      onClick={() => setIcd10Codes([...icd10Codes, { code: "", desc: "" }])}
                      className="flex items-center gap-1.5 text-sm text-primary font-medium mt-1"
                    >
                      <Plus className="w-4 h-4" /> Add ICD-10 Code
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-border p-4 flex flex-col gap-3">
                {/* Finalized banner — shown after initial send */}
                {finalizeSuccess && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Consultation sent to patient. You can still update below — changes are tracked in history.</span>
                  </div>
                )}
                {updateSuccess && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />Consultation updated and synced to patient!
                  </div>
                )}
                {(finalizeError || updateError) && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{finalizeError || updateError}
                  </div>
                )}
                {draftSaved && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary border border-border rounded-md px-3 py-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />Draft saved — your progress is preserved.
                  </div>
                )}
                {!currentSessionId && !finalizeSuccess && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />Scan a patient QR code first to enable saving drafts and sending consultations.
                  </div>
                )}

                <div className="flex gap-3 flex-wrap">
                  {/* Save Draft — only available before finalization */}
                  {!finalizeSuccess && (
                    <button
                      disabled={!currentSessionId || draftSaving}
                      onClick={async () => {
                        if (!currentSessionId || !accessToken) return;
                        setDraftSaving(true);
                        setDraftSaved(false);
                        try {
                          await doctorApi.saveDraft(accessToken, currentSessionId, soapNote, medicines, icd10Codes, {
                            bp: vitals.bp || null,
                            hr: vitals.hr ? Number(vitals.hr) : null,
                            temperature: vitals.temperature ? Number(vitals.temperature) : null,
                            spO2: vitals.spO2 ? Number(vitals.spO2) : null,
                            weight: vitals.weight ? Number(vitals.weight) : null,
                            height: vitals.height ? Number(vitals.height) : null,
                            sugar: vitals.sugar ? Number(vitals.sugar) : null,
                            pr: vitals.pr ? Number(vitals.pr) : null,
                          });
                          setDraftSaved(true);
                          setTimeout(() => setDraftSaved(false), 4000);
                          // Refresh draft sessions list so Drafts tab stays current
                          refreshDrafts();
                        } catch {/* silent */} finally {
                          setDraftSaving(false);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md disabled:opacity-40 flex items-center gap-2"
                    >
                      {draftSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {draftSaving ? "Saving…" : "Save Draft"}
                    </button>
                  )}

                  {/* Finalize & Send — first-time send */}
                  {!finalizeSuccess && (
                    <button
                      disabled={!currentSessionId || finalizing}
                      onClick={async () => {
                        if (!currentSessionId || !accessToken) {
                          setFinalizeError("No active session. Please scan a patient QR first.");
                          return;
                        }
                        setFinalizing(true);
                        setFinalizeError("");
                        try {
                          const result = await doctorApi.finalizeConsultation(
                            accessToken,
                            currentSessionId,
                            soapNote,
                            medicines,
                            icd10Codes,
                            {
                              bp: vitals.bp || null,
                              hr: vitals.hr ? Number(vitals.hr) : null,
                              temperature: vitals.temperature ? Number(vitals.temperature) : null,
                              spO2: vitals.spO2 ? Number(vitals.spO2) : null,
                              weight: vitals.weight ? Number(vitals.weight) : null,
                              height: vitals.height ? Number(vitals.height) : null,
                              sugar: vitals.sugar ? Number(vitals.sugar) : null,
                              pr: vitals.pr ? Number(vitals.pr) : null,
                            }
                          );
                          // Store prescriptionId so the doctor can update inline
                          setCurrentPrescriptionId(result.data?.prescription?._id || null);
                          setFinalizeSuccess(true);
                          setCurrentSessionId(null);
                          // Fix 4: Refresh My Patients list
                          doctorApi.getPatients(accessToken).then((r) => setPatients(r.data || [])).catch(() => {});
                          // Reload sessions list
                          doctorApi.getSessions(accessToken).then((r) => setSessions(r.data || [])).catch(() => {});
                          // Refresh drafts (finalized session is no longer a draft)
                          refreshDrafts();
                        } catch (err: any) {
                          setFinalizeError(err.message || "Failed to finalize consultation");
                        } finally {
                          setFinalizing(false);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {finalizing && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Finalize &amp; Send to Patient
                    </button>
                  )}

                  {/* Update & Sync — shown after finalization to allow post-send edits */}
                  {finalizeSuccess && currentPrescriptionId && (
                    <button
                      disabled={updating}
                      onClick={async () => {
                        if (!accessToken) return;
                        setUpdating(true);
                        setUpdateError("");
                        setUpdateSuccess(false);
                        try {
                          await doctorApi.editConsultation(
                            accessToken,
                            currentPrescriptionId,
                            soapNote,
                            medicines,
                            icd10Codes,
                            {
                              bp: vitals.bp || null,
                              hr: vitals.hr ? Number(vitals.hr) : null,
                              temperature: vitals.temperature ? Number(vitals.temperature) : null,
                              spO2: vitals.spO2 ? Number(vitals.spO2) : null,
                              weight: vitals.weight ? Number(vitals.weight) : null,
                              height: vitals.height ? Number(vitals.height) : null,
                              sugar: vitals.sugar ? Number(vitals.sugar) : null,
                              pr: vitals.pr ? Number(vitals.pr) : null,
                            },
                            "Updated on consultation screen"
                          );
                          setUpdateSuccess(true);
                          setTimeout(() => setUpdateSuccess(false), 8080);
                        } catch (err: any) {
                          setUpdateError(err.message || "Failed to update");
                        } finally {
                          setUpdating(false);
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {updating && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Update &amp; Sync to Patient
                    </button>
                  )}

                  {/* Close Session — reset the consultation screen */}
                  {finalizeSuccess && (
                    <button
                      onClick={closeSession}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:text-foreground hover:border-foreground/40 transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" /> Close Session
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "prescriptions" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="Prescription Validation" />
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">Upload a prescription image for OCR validation</p>
            <button className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md">Choose File</button>
          </div>
        </div>
      )}

      {tab === "labs" && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <SectionHeader title="Lab Reports" />
          <p className="text-sm text-muted-foreground py-6 text-center">No lab reports available.</p>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {/* Profile overview (read-only) */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title="Profile" />
            <div className="space-y-2 text-sm">
              {([
                ["Name", doctor?.name],
                ["Email", doctor?.email],
                ["Phone", doctor?.phoneNumber],
                ["Date of Birth", doctor?.dob ? formatDOB(doctor.dob) : undefined],
                ["Specialization", doctor?.specialization],
              ] as [string, string | undefined][]).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Languages Known editor */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-card">
            <SectionHeader title="Languages Known" />
            <p className="text-xs text-muted-foreground mb-3">Select all languages you can communicate in. At least one is required.</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => {
                const selected = editLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() =>
                      setEditLanguages((prev) =>
                        selected ? (prev.length > 1 ? prev.filter((l) => l !== lang) : prev) : [...prev, lang]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {settingsError && (
              <p className="mt-4 text-xs text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{settingsError}</p>
            )}
            {settingsSaved && (
              <p className="mt-4 text-xs text-primary font-medium">Settings saved successfully.</p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                disabled={settingsSaving || editLanguages.length === 0}
                onClick={async () => {
                  if (!accessToken) return;
                  setSettingsSaving(true);
                  setSettingsError("");
                  setSettingsSaved(false);
                  try {
                    const res = await doctorApi.updateProfile(accessToken, { languagesKnown: editLanguages });
                    setDoctor(res.data);
                    setEditLanguages(res.data?.languagesKnown || editLanguages);
                    setSettingsSaved(true);
                    setTimeout(() => setSettingsSaved(false), 3000);
                  } catch (err: any) {
                    setSettingsError(err?.message || "Failed to save. Please try again.");
                  } finally {
                    setSettingsSaving(false);
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground gradient-primary rounded-md disabled:opacity-40"
              >
                {settingsSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
    </>
  );
};

export default DoctorDashboard;
