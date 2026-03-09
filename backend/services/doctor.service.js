const { v4: uuidv4 } = require('uuid');
const Doctor = require('../models/Doctor.model');
const Session = require('../models/Session.model');
const Patient = require('../models/Patient.model');
const Record = require('../models/Record.model');
const Prescription = require('../models/Prescription.model');

// ─── Get Doctor by ID ──────────────────────────────────────────────────────────
const getDoctorById = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId).select('-password -refreshToken');
  if (!doctor) {
    throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  }
  return doctor;
};

// ─── Get Doctor Profile (for logged in doctor) ─────────────────────────────────
const getMyProfile = async (userId) => {
  const doctor = await Doctor.findById(userId).select('-password -refreshToken');
  if (!doctor) {
    throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  }
  return doctor;
};

// ─── Update Doctor Profile ─────────────────────────────────────────────────────
const updateDoctorProfile = async (userId, updateData) => {
  // Don't allow updating sensitive fields
  const { password, email, doctorId, ...allowedUpdates } = updateData;

  // languagesKnown is append-only: existing languages can never be removed
  if (allowedUpdates.languagesKnown) {
    const existing = await Doctor.findById(userId).select('languagesKnown').lean();
    if (existing) {
      const originalLangs = existing.languagesKnown || [];
      allowedUpdates.languagesKnown = [...new Set([...originalLangs, ...allowedUpdates.languagesKnown])];
    }
  }

  const doctor = await Doctor.findByIdAndUpdate(
    userId,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!doctor) {
    throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  }

  return doctor;
};

// ─── Get All Doctors (for listings) ────────────────────────────────────────────
const getAllDoctors = async (filters = {}) => {
  const doctors = await Doctor.find(filters).select('-password -refreshToken');
  return doctors;
};

// ─── Get Sessions for a Doctor ────────────────────────────────────────────────
const getDoctorSessions = async (doctorId) => {
  const sessions = await Session.find({ doctorId })
    .populate('patientId', 'name patientId phoneNumber')
    .sort({ startTimestamp: -1 });
  return sessions;
};

// ─── Get Unique Patients for a Doctor (via sessions) ──────────────────────────
const getDoctorPatients = async (doctorId) => {
  const sessions = await Session.find({ doctorId }).select('patientId').lean();
  const patientIds = [...new Set(sessions.map((s) => s.patientId?.toString()).filter(Boolean))];
  const patients = await Patient.find({ _id: { $in: patientIds } }).select('-password -refreshToken');
  return patients;
};

// ─── Start Session After QR Scan ──────────────────────────────────────────────
// patientIdentifier: the `id` field from the patient QR (patient _id or patientId string)
// fallback: phoneNumber from QR
const startSessionAfterQrScan = async (doctorId, patientIdentifier, phoneNumber) => {
  // Try to locate the patient
  let patient = null;

  if (patientIdentifier) {
    // Could be Mongo _id or the custom patientId string
    const isObjectId = /^[a-f\d]{24}$/i.test(patientIdentifier);
    if (isObjectId) {
      patient = await Patient.findById(patientIdentifier).select('-password -refreshToken');
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: patientIdentifier }).select('-password -refreshToken');
    }
  }

  // Fallback: find by phone
  if (!patient && phoneNumber) {
    patient = await Patient.findOne({ phoneNumber }).select('-password -refreshToken');
  }

  if (!patient) {
    throw Object.assign(new Error('Patient not found. Cannot start session.'), { statusCode: 404 });
  }

  // Check if there's already an ongoing session between this doctor and patient
  const existingOngoing = await Session.findOne({
    doctorId,
    patientId: patient._id,
    status: 'ongoing',
  });
  if (existingOngoing) {
    // Return the existing session rather than creating a duplicate
    return { session: existingOngoing, patient };
  }

  const session = await Session.create({
    sessionId: `SES-${uuidv4().slice(0, 8).toUpperCase()}`,
    doctorId,
    patientId: patient._id,
    startTimestamp: new Date(),
    status: 'ongoing',
  });

  // Also push session ref into doctor's sessions array
  await Doctor.findByIdAndUpdate(doctorId, { $push: { sessions: session._id } });

  return { session, patient };
};

// ─── Finalize Consultation (create Record + Prescription, close Session) ──────
const finalizeConsultation = async (doctorId, sessionId, { soapNote, medicines, icd10Codes, vitals }) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }
  if (session.doctorId.toString() !== doctorId.toString()) {
    throw Object.assign(new Error('Unauthorized: This session does not belong to you'), { statusCode: 403 });
  }

  // Build structured vitals from the doctor's input
  const structuredVitals = {
    bp: vitals?.bp || null,
    hr: vitals?.hr ? Number(vitals.hr) : null,
    temperature: vitals?.temperature ? Number(vitals.temperature) : null,
    spO2: vitals?.spO2 ? Number(vitals.spO2) : null,
    weight: vitals?.weight ? Number(vitals.weight) : null,
    height: vitals?.height ? Number(vitals.height) : null,
    sugar: vitals?.sugar ? Number(vitals.sugar) : null,
    pr: vitals?.pr ? Number(vitals.pr) : null,
  };

  // Create the health Record
  const record = await Record.create({
    recordId: `REC-${uuidv4().slice(0, 8).toUpperCase()}`,
    patientId: session.patientId,
    doctorId,
    timestamp: new Date(),
    complaint: soapNote?.subjective?.split('\n')[0] || 'Consultation',
    diagnosedComplaint: soapNote?.assessment || null,
    vitals: structuredVitals,
    medicines: [],
  });

  // Create the Prescription — store all consultation details in `data` (Mixed field)
  const prescription = await Prescription.create({
    prescriptionId: `PRE-${uuidv4().slice(0, 8).toUpperCase()}`,
    patientId: session.patientId,
    doctorId,
    recordId: record._id,
    data: {
      sessionId: sessionId,
      soapNote: soapNote || {},
      icd10Codes: icd10Codes || [],
      consultationMedicines: medicines || [],
      vitals: structuredVitals,
      editHistory: [],
    },
    medicines: [],
    issuedAt: new Date(),
  });

  // Mark session as completed
  // soapNote.plan may be an object (AI-structured) or a plain string — normalise to String for the schema
  const planValue = soapNote?.plan;
  const notesString = planValue == null
    ? null
    : typeof planValue === 'object'
      ? JSON.stringify(planValue)
      : String(planValue);

  await Session.findByIdAndUpdate(sessionId, {
    status: 'completed',
    endTimestamp: new Date(),
    notes: notesString,
    draftData: null, // clear draft once finalized
  });

  return { record, prescription };
};

// ─── Edit Consultation (with full history tracking) ────────────────────────────
const editConsultation = async (doctorId, prescriptionId, { soapNote, medicines, icd10Codes, vitals, editNote }) => {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) {
    throw Object.assign(new Error('Prescription not found'), { statusCode: 404 });
  }
  if (prescription.doctorId.toString() !== doctorId.toString()) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  }

  const currentData = prescription.data || {};
  const editHistory = Array.isArray(currentData.editHistory) ? currentData.editHistory : [];

  // Push a snapshot of the CURRENT state to history before overwriting
  editHistory.push({
    editedAt: new Date(),
    editNote: editNote || 'Updated by doctor',
    snapshot: {
      soapNote: currentData.soapNote,
      icd10Codes: currentData.icd10Codes,
      consultationMedicines: currentData.consultationMedicines,
      vitals: currentData.vitals,
    },
  });

  const structuredVitals = {
    bp: vitals?.bp ?? currentData.vitals?.bp ?? null,
    hr: vitals?.hr != null ? Number(vitals.hr) : (currentData.vitals?.hr ?? null),
    temperature: vitals?.temperature != null ? Number(vitals.temperature) : (currentData.vitals?.temperature ?? null),
    spO2: vitals?.spO2 != null ? Number(vitals.spO2) : (currentData.vitals?.spO2 ?? null),
    weight: vitals?.weight != null ? Number(vitals.weight) : (currentData.vitals?.weight ?? null),
    height: vitals?.height != null ? Number(vitals.height) : (currentData.vitals?.height ?? null),
    sugar: vitals?.sugar != null ? Number(vitals.sugar) : (currentData.vitals?.sugar ?? null),
    pr: vitals?.pr != null ? Number(vitals.pr) : (currentData.vitals?.pr ?? null),
  };

  // Update prescription.data with new values
  prescription.data = {
    soapNote: soapNote ?? currentData.soapNote,
    icd10Codes: icd10Codes ?? currentData.icd10Codes,
    consultationMedicines: medicines ?? currentData.consultationMedicines,
    vitals: structuredVitals,
    editHistory,
  };
  prescription.markModified('data');
  await prescription.save();

  // Also update linked Record vitals + diagnosis
  if (prescription.recordId) {
    await Record.findByIdAndUpdate(prescription.recordId, {
      $set: {
        diagnosedComplaint: soapNote?.assessment ?? currentData.soapNote?.assessment ?? null,
        vitals: structuredVitals,
      },
    });
  }

  return prescription;
};

// ─── Get Patient History for a Doctor (records + prescriptions) ───────────────
// Returns the FULL patient history across all doctors so the consulting doctor
// has complete context. Records and prescriptions are populated with doctor info.
const getPatientHistory = async (_doctorId, patientId) => {
  const [records, prescriptions] = await Promise.all([
    Record.find({ patientId })
      .populate('doctorId', 'name specialization')
      .sort({ timestamp: -1 })
      .limit(50),
    Prescription.find({ patientId })
      .populate('doctorId', 'name specialization')
      .sort({ createdAt: -1 })
      .limit(50),
  ]);
  return { records, prescriptions };
};

// ─── Save Draft Consultation ────────────────────────────────────────────────────
const saveDraft = async (doctorId, sessionId, { soapNote, medicines, icd10Codes, vitals }) => {
  const session = await Session.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.doctorId.toString() !== doctorId.toString()) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  }
  if (session.status === 'completed') {
    throw Object.assign(new Error('Session is already completed. Use edit to update.'), { statusCode: 400 });
  }

  session.draftData = { soapNote, medicines, icd10Codes, vitals, savedAt: new Date() };
  session.markModified('draftData');
  await session.save();
  return { session };
};

// ─── Get Consultation Details for a Session ────────────────────────────────────
const getConsultation = async (sessionId, doctorId) => {
  const session = await Session.findById(sessionId)
    .populate('patientId', 'name patientId phoneNumber bloodGroup conditions allergies')
    .populate('doctorId', 'name specialization');

  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.doctorId._id.toString() !== doctorId.toString()) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  }

  // Look up prescription linked to this specific session (stored in data.sessionId)
  let prescription = await Prescription.findOne({ 'data.sessionId': sessionId, doctorId })
    .sort({ createdAt: -1 });

  // Fallback: get latest prescription for this doctor+patient pair
  if (!prescription) {
    prescription = await Prescription.findOne({ doctorId, patientId: session.patientId._id })
      .sort({ createdAt: -1 });
  }

  return { session, prescription };
};

// ─── Get Sessions With Unsent Drafts ────────────────────────────────────────
const getDraftSessions = async (doctorId) => {
  const sessions = await Session.find({
    doctorId,
    draftData: { $ne: null },
    status: { $ne: 'completed' },
  })
    .populate('patientId', 'name patientId phoneNumber bloodGroup conditions allergies dob gender languagesKnown')
    .sort({ updatedAt: -1 });
  return sessions;
};

module.exports = {
  getDoctorById,
  getMyProfile,
  updateDoctorProfile,
  getAllDoctors,
  getDoctorSessions,
  getDraftSessions,
  getDoctorPatients,
  startSessionAfterQrScan,
  getPatientHistory,
  saveDraft,
  finalizeConsultation,
  editConsultation,
  getConsultation,
};
