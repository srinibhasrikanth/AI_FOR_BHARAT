// ─── Central API Module ────────────────────────────────────────────────────────
// All backend communication goes through this file.
// Base URL is configured via VITE_API_URL in .env

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// ─── Generic request helper ────────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Don't set Content-Type for FormData - browser will set it automatically with boundary
  const isFormData = options.body instanceof FormData;
  
  const res = await fetch(`${BASE_URL}/${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  let data: any;

  try {
    data = await res.json();
  } catch {
    data = null; // prevents crash if no JSON body
  }

  if (!res.ok) {
    const message =
      data?.message || `Request failed with status ${res.status}`;
    throw Object.assign(new Error(message), {
      statusCode: res.status,
      data,
    });
  }

  return data as T;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RegisterDoctorPayload {
  name: string;
  email: string;
  dob: string;               // ISO date string e.g. "1980-05-15"
  specialization: string;
  phoneNumber?: string;
  languagesKnown?: string[];
  preferredLanguage?: string; // 'en' | 'hi' | 'te'
}

export interface RegisterPatientPayload {
  name: string;
  email: string;
  gender: "male" | "female" | "other" | "prefer_not_to_say";
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  phoneNumber: string;
  dob: string;               // ISO date string
  languagesKnown?: string[];
  preferredLanguage?: "en" | "hi" | "te";  // derived from signup language selection
  emergencyContacts?: {
    name?: string;
    phoneNumber: string;
    address?: string;
    relation?: string;
  }[];
}

export interface RegisterPharmacistPayload {
  name: string;
  email: string;
  designation: string;
  phoneNumber: string;
  languagesKnown?: string[];
  preferredLanguage?: string;
}

export interface RegisterAdminPayload {
  name: string;
  email: string;
}

export interface LoginPayload {
  identifier: string;  // email address or phone number
  password: string;
}

export interface UserData {
  _id: string;
  email: string;
  name: string;
  role: "patient" | "doctor" | "pharmacist" | "admin";
  [key: string]: any;
}

export interface LoginResponse {
  user: UserData;
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  user?: UserData;
}

export interface SpeechToTextResponse {
  request_id: string;
  transcript: string;
  formatted_transcript: string;
  timestamps: object | null;
  diarized_transcript: object | null;
  language_code: string;
  language_probability: number;
}

export interface RegisterPatientVoicePayload {
  name: string;
  email: string;             // required — activation email will be sent here
  phoneNumber: string;
  dob: string;
  gender: "male" | "female" | "other" | "prefer_not_to_say";
  bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  languagesKnown?: string[];
  preferredLanguage?: "en" | "hi" | "te";
  emergencyContacts?: { name?: string; phoneNumber: string; relation?: string }[];
}

export interface VoiceRegisterResponse {
  patient: Record<string, any>;
}

// ─── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * POST api/v1/auth/check-availability
   * Check whether an email or phone number is already registered across all user types.
   */
  checkAvailability: (payload: { email?: string; phoneNumber?: string }) =>
    request<ApiResponse<{ emailTaken: boolean; phoneTaken: boolean }>>(
      "api/v1/auth/check-availability",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  /**
   * POST api/v1/auth/register/doctor
   */
  registerDoctor: (payload: RegisterDoctorPayload) =>
    request<ApiResponse<unknown>>("api/v1/auth/register/doctor", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * POST api/v1/auth/register/patient
   */
  registerPatient: (payload: RegisterPatientPayload) =>
    request<ApiResponse<unknown>>("api/v1/auth/register/patient", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * POST api/v1/auth/register/pharmacist
   */
  registerPharmacist: (payload: RegisterPharmacistPayload) =>
    request<ApiResponse<unknown>>("api/v1/auth/register/pharmacist", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * POST api/v1/auth/register/admin
   */
  registerAdmin: (payload: RegisterAdminPayload) =>
    request<ApiResponse<unknown>>("api/v1/auth/register/admin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * POST api/v1/auth/login
   */
  login: (payload: LoginPayload) =>
    request<ApiResponse<LoginResponse>>("api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /**
   * POST api/v1/auth/refresh
   */
  refreshToken: (refreshToken?: string | null) =>
    request<ApiResponse<RefreshResponse>>("api/v1/auth/refresh", {
      method: "POST",
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    }),

  /**
   * POST api/v1/auth/logout
   */
  logout: () =>
    request<ApiResponse<null>>("api/v1/auth/logout", {
      method: "POST",
    }),

  /**
   * POST api/v1/auth/register/patient/voice
   * Sends an audio file (Blob) as multipart/form-data and returns the Sarvam AI transcription.
   */
  /**
   * POST api/v1/auth/tts
   * Synthesizes speech using Sarvam AI (Hindi / Telugu).
   * Returns base64-encoded WAV audio string.
   */
  synthesizeSpeech: (text: string, languageCode: string, speaker?: string) =>
    request<ApiResponse<{ audio: string }>>("api/v1/auth/tts", {
      method: "POST",
      body: JSON.stringify({ text, language_code: languageCode, speaker }),
    }),

  /**
   * POST api/v1/auth/register/patient/voice
   * Sends an audio blob for transcription. Optionally pass languageCode (Sarvam AI code, e.g. "hi-IN").
   */
  signupPatientVoice: (audioBlob: Blob, fileName: string = "audio.wav", languageCode: string = "en-IN") => {
    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);
    formData.append("language_code", languageCode);
    return request<ApiResponse<SpeechToTextResponse>>(
      "api/v1/auth/register/patient/voice",
      { method: "POST", body: formData }
    );
  },

  /**
   * POST api/v1/auth/register/patient/voice-register
   * Registers a patient from voice-collected details with an auto-generated password.
   */
  registerPatientVoice: (payload: RegisterPatientVoicePayload) =>
    request<ApiResponse<VoiceRegisterResponse>>(
      "api/v1/auth/register/patient/voice-register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ),

  /**
   * POST api/v1/auth/request-reset
   * Sends a 6-digit OTP to the given email for password reset.
   */
  requestPasswordReset: (email: string) =>
    request<ApiResponse<{ message: string; lang?: string }>>("api/v1/auth/request-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /**
   * POST api/v1/auth/reset-password
   * Verifies OTP and updates the password.
   */
  resetPassword: (email: string, otp: string, newPassword: string) =>
    request<ApiResponse<{ message: string }>>("api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, newPassword }),
    }),
};

// ─── Patient API ───────────────────────────────────────────────────────────────

/**
 * Helper to add Authorization header with token
 */
const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Compress / resize an image File using an off-screen canvas before upload.
 * - Max dimension: 1800 px (preserves readability of prescription text)
 * - JPEG quality: 0.82
 * - PDFs are returned as-is (canvas cannot render PDF)
 * This prevents 413 errors caused by large phone-camera JPEGs (often 8–15 MB).
 */
// Pass files through as-is — no client-side compression
const compressImage = (file: File): Promise<File> => Promise.resolve(file);

export const patientApi = {
  /**
   * GET api/v1/patient/profile - Get logged in patient's profile
   */
  getProfile: (token: string) =>
    request<ApiResponse<UserData>>("api/v1/patient/profile", {
      headers: getAuthHeaders(token),
    }),

  /**
   * PUT api/v1/patient/profile - Update logged in patient's profile
   */
  updateProfile: (token: string, data: Partial<UserData>) =>
    request<ApiResponse<UserData>>("api/v1/patient/profile", {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  /**
   * GET api/v1/patient/records - Get health records for the logged-in patient
   */
  getRecords: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/patient/records", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/patient/lab-reports - Get lab reports for the logged-in patient
   */
  getLabReports: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/patient/lab-reports", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/patient/prescriptions - Get prescriptions for the logged-in patient
   */
  getPrescriptions: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/patient/prescriptions", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/patient/sessions - Get consultation sessions for the logged-in patient
   */
  getSessions: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/patient/sessions", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/patient/consultation/:sessionId - Get full consultation details for a session
   */
  getConsultation: (token: string, sessionId: string) =>
    request<ApiResponse<any>>(`api/v1/patient/consultation/${sessionId}`, {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/patient/chatbot/welcome - Get chatbot welcome message for the patient
   */
  getChatbotWelcome: (token: string, language?: string) =>
    request<ApiResponse<{ text: string; suggestions: string[]; language: string }>>(
      `api/v1/patient/chatbot/welcome${language ? `?language=${language}` : ""}`,
      { headers: getAuthHeaders(token) }
    ),

  /**
   * POST api/v1/patient/chatbot - Send message to health chatbot
   */
  sendChatMessage: (
    token: string,
    payload: { messages: { role: "user" | "assistant"; content: string }[]; language?: string }
  ) =>
    request<ApiResponse<{ reply: string; suggestions: string[]; navigateTo: string | null; language: string }>>(
      "api/v1/patient/chatbot",
      {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      }
    ),

  /**
   * POST api/v1/patient/chatbot/analyze-image
   * Uploads an image with the patient's description and gets AI-powered analysis.
   * Automatically detects whether the image is of food (calorie check) or a medical condition.
   */
  analyzeChatbotImage: (token: string, imageFile: File, userText: string, language: string = "en") => {
    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("userText", userText);
    formData.append("language", language);
    return request<ApiResponse<{
      isFoodRelated: boolean;
      isDiagnosisRelated: boolean;
      foodInfo: {
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
      } | null;
      reply: string;
      cautions: string[];
      suggestions: string[];
    }>>(
      "api/v1/patient/chatbot/analyze-image",
      {
        method: "POST",
        headers: getAuthHeaders(token),
        body: formData,
      }
    );
  },

  /**
   * Upload a prescription image for AI digitization.
   * @param token      - Patient access token
   * @param imageFile  - Image File (JPG, PNG, WEBP, HEIC)
   */
  digitizePrescription: async (token: string, imageFile: File) => {
    // Compress large images before sending to avoid 413 from CloudFront / multer
    const compressed = await compressImage(imageFile);
    const formData = new FormData();
    formData.append("image", compressed);
    return request<ApiResponse<{
      rawText: string;
      metadata: {
        prescribedBy: string | null;
        clinicName: string | null;
        date: string | null;
        patientName: string | null;
        diagnosis: string | null;
      };
      medicines: Array<{
        name: string;
        dosage: string;
        timing: string[];
        durationDays: number;
        instructions: string;
        medicineId?: string;
        inventoryName?: string;
        cost?: number;
        availableQty?: number;
        matchConfidence: "exact" | "partial" | "none";
      }>;
      icd_codes: Array<{ code: string; description: string }>;
      prescription: Record<string, any>;
    }>>("api/v1/patient/prescription/digitize", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: formData,
    });
  },

  /** GET api/v1/patient/medicines - browse available medicines from pharmacy */
  getMedicines: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/patient/medicines", {
      headers: getAuthHeaders(token),
    }),

  /** POST api/v1/patient/orders - create Razorpay order */
  createOrder: (
    token: string,
    payload: { prescriptionId?: string; items: { medicineId: string; requiredQty: number; isPrescribed?: boolean }[] }
  ) =>
    request<ApiResponse<any>>("api/v1/patient/orders", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload),
    }),

  /** POST api/v1/patient/orders/verify-payment - verify Razorpay payment */
  verifyPayment: (
    token: string,
    payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  ) =>
    request<ApiResponse<any>>("api/v1/patient/orders/verify-payment", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload),
    }),

  /** GET api/v1/patient/orders - list patient's orders */
  getOrders: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/patient/orders", {
      headers: getAuthHeaders(token),
    }),

  /** POST api/v1/patient/records/translate - translate a record to the patient's language */
  translateRecord: (
    token: string,
    payload: {
      soapNote?: any;
      complaint?: string;
      diagnosedComplaint?: string;
      icdCodes?: any[];
      consultationMedicines?: any[];
      patientName?: string;
      targetLanguage: "hi" | "te";
    }
  ) =>
    request<ApiResponse<{ complaint: string; diagnosedComplaint: string; soap: any }>>(
      "api/v1/patient/records/translate",
      {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      }
    ),
};

// ─── Doctor API ────────────────────────────────────────────────────────────────

export const doctorApi = {
  /**
   * GET api/v1/doctor/profile - Get logged in doctor's profile
   */
  getProfile: (token: string) =>
    request<ApiResponse<UserData>>("api/v1/doctor/profile", {
      headers: getAuthHeaders(token),
    }),

  /**
   * PUT api/v1/doctor/profile - Update logged in doctor's profile
   */
  updateProfile: (token: string, data: Partial<UserData>) =>
    request<ApiResponse<UserData>>("api/v1/doctor/profile", {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  /**
   * GET api/v1/doctor/all - Get all doctors
   */
  getAll: (token: string) =>
    request<ApiResponse<UserData[]>>("api/v1/doctor/all", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/doctor/sessions - Get sessions for logged-in doctor
   */
  getSessions: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/doctor/sessions", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/doctor/patients - Get unique patients for logged-in doctor
   */
  getPatients: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/doctor/patients", {
      headers: getAuthHeaders(token),
    }),

  /**
   * POST api/v1/doctor/scan-patient - Create/resume a session after QR scan
   */
  scanPatient: (token: string, patientId?: string, phoneNumber?: string) =>
    request<ApiResponse<{ session: any; patient: any }>>("api/v1/doctor/scan-patient", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ patientId, phoneNumber }),
    }),

  /**
   * POST api/v1/doctor/consultation/draft - Save current work as a draft
   */
  saveDraft: (
    token: string,
    sessionId: string,
    soapNote: Record<string, string>,
    medicines: any[],
    icd10Codes: { code: string; desc: string }[],
    vitals?: Record<string, string | number | null>
  ) =>
    request<ApiResponse<any>>("api/v1/doctor/consultation/draft", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ sessionId, soapNote, medicines, icd10Codes, vitals }),
    }),

  /**
   * POST api/v1/doctor/consultation/finalize - Save SOAP, medicines, ICD-10 and close session
   */
  finalizeConsultation: (
    token: string,
    sessionId: string,
    soapNote: Record<string, string>,
    medicines: any[],
    icd10Codes: { code: string; desc: string }[],
    vitals?: Record<string, string | number | null>
  ) =>
    request<ApiResponse<any>>("api/v1/doctor/consultation/finalize", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ sessionId, soapNote, medicines, icd10Codes, vitals }),
    }),

  /**
   * PUT api/v1/doctor/consultation/:prescriptionId/edit - Edit consultation and maintain history
   */
  editConsultation: (
    token: string,
    prescriptionId: string,
    soapNote: Record<string, string>,
    medicines: any[],
    icd10Codes: { code: string; desc: string }[],
    vitals?: Record<string, string | number | null>,
    editNote?: string
  ) =>
    request<ApiResponse<any>>(`api/v1/doctor/consultation/${prescriptionId}/edit`, {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ soapNote, medicines, icd10Codes, vitals, editNote }),
    }),

  /**
   * GET api/v1/doctor/consultation/:sessionId - Get full consultation details
   */
  getConsultation: (token: string, sessionId: string) =>
    request<ApiResponse<any>>(`api/v1/doctor/consultation/${sessionId}`, {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/doctor/patient/:patientId/history - Records + prescriptions for a patient
   */
  getPatientHistory: (token: string, patientId: string) =>
    request<ApiResponse<{ records: any[]; prescriptions: any[] }>>(
      `api/v1/doctor/patient/${patientId}/history`,
      { headers: getAuthHeaders(token) }
    ),

  /**
   * GET api/v1/doctor/draft-sessions - Sessions with unsent drafts
   */
  getDraftSessions: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/doctor/draft-sessions", {
      headers: getAuthHeaders(token),
    }),

  /**
   * POST api/v1/doctor/voice/process
   * Upload a recorded audio file and run the full AI clinical pipeline:
   * STT + diarization → LangGraph SOAP / vitals / ICD-10 / prescription.
   */
  processVoice: (token: string, formData: FormData) =>
    request<ApiResponse<any>>("api/v1/doctor/voice/process", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: formData,
    }),

  /**
   * POST api/v1/doctor/voice/translate
   * Translate a SOAP note to a patient-friendly summary in the target language.
   */
  translateNote: (
    token: string,
    soapNote: Record<string, string>,
    targetLanguage?: string,
    opts?: { patientName?: string; icdCodes?: any[]; prescription?: any[] }
  ) =>
    request<ApiResponse<any>>("api/v1/doctor/voice/translate", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ soapNote, targetLanguage, ...opts }),
    }),
};

// ─── Pharmacist API ────────────────────────────────────────────────────────────

export const pharmacistApi = {
  /**
   * GET api/v1/pharmacist/profile - Get logged in pharmacist's profile
   */
  getProfile: (token: string) =>
    request<ApiResponse<UserData>>("api/v1/pharmacist/profile", {
      headers: getAuthHeaders(token),
    }),

  /**
   * PUT api/v1/pharmacist/profile - Update logged in pharmacist's profile
   */
  updateProfile: (token: string, data: Partial<UserData>) =>
    request<ApiResponse<UserData>>("api/v1/pharmacist/profile", {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  /**
   * GET api/v1/pharmacist/prescriptions - Get all prescriptions for dispensing
   */
  getPrescriptions: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/pharmacist/prescriptions", {
      headers: getAuthHeaders(token),
    }),

  /**
   * GET api/v1/pharmacist/medicines - Get medicine inventory
   */
  getMedicines: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/pharmacist/medicines", {
      headers: getAuthHeaders(token),
    }),

  /** GET api/v1/pharmacist/medicines/low-stock */
  getLowStockMedicines: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/pharmacist/medicines/low-stock", {
      headers: getAuthHeaders(token),
    }),

  /** POST api/v1/pharmacist/medicines */
  addMedicine: (token: string, data: Record<string, any>) =>
    request<ApiResponse<any>>("api/v1/pharmacist/medicines", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  /** PUT api/v1/pharmacist/medicines/:id */
  updateMedicine: (token: string, id: string, data: Record<string, any>) =>
    request<ApiResponse<any>>(`api/v1/pharmacist/medicines/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  /** DELETE api/v1/pharmacist/medicines/:id */
  deleteMedicine: (token: string, id: string) =>
    request<ApiResponse<any>>(`api/v1/pharmacist/medicines/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    }),

  /** POST api/v1/pharmacist/medicines/:id/restock */
  restockMedicine: (token: string, id: string, quantity: number, notes?: string) =>
    request<ApiResponse<any>>(`api/v1/pharmacist/medicines/${id}/restock`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ quantity, notes }),
    }),

  /** GET api/v1/pharmacist/inventory/stats */
  getInventoryStats: (token: string) =>
    request<ApiResponse<any>>("api/v1/pharmacist/inventory/stats", {
      headers: getAuthHeaders(token),
    }),

  /** GET api/v1/pharmacist/inventory/logs */
  getInventoryLogs: (token: string, params?: { page?: number; limit?: number; type?: string }) => {
    const query = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString() : "";
    return request<ApiResponse<any>>(`api/v1/pharmacist/inventory/logs${query}`, {
      headers: getAuthHeaders(token),
    });
  },

  /** GET api/v1/pharmacist/prescriptions/stats */
  getPrescriptionStats: (token: string) =>
    request<ApiResponse<any>>("api/v1/pharmacist/prescriptions/stats", {
      headers: getAuthHeaders(token),
    }),

  /** POST api/v1/pharmacist/prescriptions/:id/dispense */
  dispensePrescription: (token: string, id: string, notes?: string) =>
    request<ApiResponse<any>>(`api/v1/pharmacist/prescriptions/${id}/dispense`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ notes }),
    }),

  /** POST api/v1/pharmacist/prescriptions/:id/flag */
  flagPrescription: (token: string, id: string, reason: string) =>
    request<ApiResponse<any>>(`api/v1/pharmacist/prescriptions/${id}/flag`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ reason }),
    }),

  /** POST api/v1/pharmacist/orders/scan - validate QR token */
  scanQrToken: (token: string, qrToken: string) =>
    request<ApiResponse<any>>("api/v1/pharmacist/orders/scan", {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ token: qrToken }),
    }),

  /** POST api/v1/pharmacist/orders/:id/dispense - dispense a paid order */
  dispenseOrder: (token: string, orderId: string, notes?: string) =>
    request<ApiResponse<any>>(`api/v1/pharmacist/orders/${orderId}/dispense`, {
      method: "POST",
      headers: getAuthHeaders(token),
      body: JSON.stringify({ notes }),
    }),
};

// ─── Admin API ─────────────────────────────────────────────────────────────────

export const adminApi = {
  // Patient management
  getAllPatients: (token: string) =>
    request<ApiResponse<UserData[]>>("api/v1/admin/patients", {
      headers: getAuthHeaders(token),
    }),

  getPatient: (token: string, id: string) =>
    request<ApiResponse<UserData>>(`api/v1/admin/patients/${id}`, {
      headers: getAuthHeaders(token),
    }),

  updatePatient: (token: string, id: string, data: Partial<UserData>) =>
    request<ApiResponse<UserData>>(`api/v1/admin/patients/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  deletePatient: (token: string, id: string) =>
    request<ApiResponse<null>>(`api/v1/admin/patients/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    }),

  // Doctor management
  getAllDoctors: (token: string) =>
    request<ApiResponse<UserData[]>>("api/v1/admin/doctors", {
      headers: getAuthHeaders(token),
    }),

  getDoctor: (token: string, id: string) =>
    request<ApiResponse<UserData>>(`api/v1/admin/doctors/${id}`, {
      headers: getAuthHeaders(token),
    }),

  updateDoctor: (token: string, id: string, data: Partial<UserData>) =>
    request<ApiResponse<UserData>>(`api/v1/admin/doctors/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  deleteDoctor: (token: string, id: string) =>
    request<ApiResponse<null>>(`api/v1/admin/doctors/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    }),

  // Pharmacist management
  getAllPharmacists: (token: string) =>
    request<ApiResponse<UserData[]>>("api/v1/admin/pharmacists", {
      headers: getAuthHeaders(token),
    }),

  getPharmacist: (token: string, id: string) =>
    request<ApiResponse<UserData>>(`api/v1/admin/pharmacists/${id}`, {
      headers: getAuthHeaders(token),
    }),

  updatePharmacist: (token: string, id: string, data: Partial<UserData>) =>
    request<ApiResponse<UserData>>(`api/v1/admin/pharmacists/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    }),

  deletePharmacist: (token: string, id: string) =>
    request<ApiResponse<null>>(`api/v1/admin/pharmacists/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(token),
    }),

  // Sessions
  getAllSessions: (token: string) =>
    request<ApiResponse<any[]>>("api/v1/admin/sessions", {
      headers: getAuthHeaders(token),
    }),
};

// ─── Public API (no auth required) ────────────────────────────────────────────

export const publicApi = {
  /**
   * GET api/v1/public/patient/:patientId - Public patient info for Emergency QR page
   */
  getPatientEmergencyInfo: (patientId: string) =>
    request<ApiResponse<any>>(`api/v1/public/patient/${patientId}`),
};
