const Patient = require('../models/Patient.model');
const Record = require('../models/Record.model');
const LabReport = require('../models/LabReport.model');
const Prescription = require('../models/Prescription.model');
const Session = require('../models/Session.model');

// ─── Get Patient by ID ─────────────────────────────────────────────────────────
const getPatientById = async (patientId) => {
  const patient = await Patient.findById(patientId).select('-password -refreshToken');
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }
  return patient;
};

// ─── Get Patient Profile (for logged in patient) ───────────────────────────────
const getMyProfile = async (userId) => {
  const patient = await Patient.findById(userId).select('-password -refreshToken');
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }
  return patient;
};

// ─── Update Patient Profile ────────────────────────────────────────────────────
const updatePatientProfile = async (userId, updateData) => {
  // Don't allow updating sensitive fields or the language chosen at signup
  const { password, email, patientId, preferredLanguage, ...allowedUpdates } = updateData;

  // Persist languagesKnown exactly as selected by user (allow removing languages)
  if (Object.prototype.hasOwnProperty.call(allowedUpdates, 'languagesKnown')) {
    if (!Array.isArray(allowedUpdates.languagesKnown)) {
      throw Object.assign(new Error('languagesKnown must be an array'), { statusCode: 400 });
    }

    const normalizedLanguages = [...new Set(
      allowedUpdates.languagesKnown
        .map((lang) => String(lang || '').trim())
        .filter(Boolean)
    )];

    if (normalizedLanguages.length === 0) {
      throw Object.assign(new Error('At least one language is required'), { statusCode: 400 });
    }

    allowedUpdates.languagesKnown = normalizedLanguages;
  }

  const patient = await Patient.findByIdAndUpdate(
    userId,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  return patient;
};

// ─── Get Patient Records ────────────────────────────────────────────────────────
const getPatientRecords = async (patientId) => {
  const records = await Record.find({ patientId })
    .populate('doctorId', 'name specialization')
    .sort({ timestamp: -1 });
  return records;
};

// ─── Get Patient Lab Reports ───────────────────────────────────────────────────
const getPatientLabReports = async (patientId) => {
  // LabReport links via Record; find records for patient then get their lab reports
  const records = await Record.find({ patientId }).select('_id').lean();
  const recordIds = records.map((r) => r._id);
  const labReports = await LabReport.find({ recordId: { $in: recordIds } })
    .populate('doctorId', 'name')
    .sort({ orderedTimestamp: -1 });
  return labReports;
};

// ─── Get Patient Prescriptions ──────────────────────────────────────────────────
const getPatientPrescriptions = async (patientId) => {
  const prescriptions = await Prescription.find({ patientId })
    .populate('doctorId', 'name specialization')
    .populate('medicines.medicineId', 'name dosage')
    .sort({ createdAt: -1 });
  return prescriptions;
};

// ─── Get Patient Sessions ──────────────────────────────────────────────────────
const getPatientSessions = async (patientId) => {
  const sessions = await Session.find({ patientId })
    .populate('doctorId', 'name specialization phoneNumber')
    .sort({ startTimestamp: -1 });
  return sessions;
};

// ─── Get Patient Consultation for a specific Session ──────────────────────────
const getPatientConsultation = async (sessionId, patientId) => {
  const session = await Session.findById(sessionId)
    .populate('doctorId', 'name specialization')
    .populate('patientId', 'name patientId');

  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.patientId._id.toString() !== patientId.toString()) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  }

  const prescription = await Prescription.findOne({ patientId, doctorId: session.doctorId })
    .sort({ createdAt: -1 });

  const record = prescription?.recordId
    ? await Record.findById(prescription.recordId)
    : null;

  return { session, prescription, record };
};

module.exports = {
  getPatientById,
  getMyProfile,
  updatePatientProfile,
  getPatientRecords,
  getPatientLabReports,
  getPatientPrescriptions,
  getPatientSessions,
  getPatientConsultation,
};
