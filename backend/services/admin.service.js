const Patient = require('../models/Patient.model');
const Doctor = require('../models/Doctor.model');
const Pharmacist = require('../models/Pharmacist.model');
const Session = require('../models/Session.model');

// ─── Patient CRUD Operations ───────────────────────────────────────────────────

const getAllPatients = async (filters = {}) => {
  const patients = await Patient.find(filters).select('-password -refreshToken');
  return patients;
};

const getPatientById = async (id) => {
  const patient = await Patient.findById(id).select('-password -refreshToken');
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }
  return patient;
};

const updatePatient = async (id, updateData) => {
  const { password, patientId, ...allowedUpdates } = updateData;

  const patient = await Patient.findByIdAndUpdate(
    id,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  return patient;
};

const deletePatient = async (id) => {
  const patient = await Patient.findByIdAndDelete(id);
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }
  return { message: 'Patient deleted successfully' };
};

// ─── Doctor CRUD Operations ────────────────────────────────────────────────────

const getAllDoctors = async (filters = {}) => {
  const doctors = await Doctor.find(filters).select('-password -refreshToken');
  return doctors;
};

const getDoctorById = async (id) => {
  const doctor = await Doctor.findById(id).select('-password -refreshToken');
  if (!doctor) {
    throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  }
  return doctor;
};

const updateDoctor = async (id, updateData) => {
  const { password, doctorId, ...allowedUpdates } = updateData;

  const doctor = await Doctor.findByIdAndUpdate(
    id,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!doctor) {
    throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  }

  return doctor;
};

const deleteDoctor = async (id) => {
  const doctor = await Doctor.findByIdAndDelete(id);
  if (!doctor) {
    throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
  }
  return { message: 'Doctor deleted successfully' };
};

// ─── Pharmacist CRUD Operations ────────────────────────────────────────────────

const getAllPharmacists = async (filters = {}) => {
  const pharmacists = await Pharmacist.find(filters).select('-password -refreshToken');
  return pharmacists;
};

const getPharmacistById = async (id) => {
  const pharmacist = await Pharmacist.findById(id).select('-password -refreshToken');
  if (!pharmacist) {
    throw Object.assign(new Error('Pharmacist not found'), { statusCode: 404 });
  }
  return pharmacist;
};

const updatePharmacist = async (id, updateData) => {
  const { password, pharmacistId, ...allowedUpdates } = updateData;

  const pharmacist = await Pharmacist.findByIdAndUpdate(
    id,
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!pharmacist) {
    throw Object.assign(new Error('Pharmacist not found'), { statusCode: 404 });
  }

  return pharmacist;
};

const deletePharmacist = async (id) => {
  const pharmacist = await Pharmacist.findByIdAndDelete(id);
  if (!pharmacist) {
    throw Object.assign(new Error('Pharmacist not found'), { statusCode: 404 });
  }
  return { message: 'Pharmacist deleted successfully' };
};

// ─── Session Operations ──────────────────────────────────────────────────────────────
const getAllSessions = async () => {
  const sessions = await Session.find()
    .populate('doctorId', 'name specialization')
    .populate('patientId', 'name patientId')
    .sort({ startTimestamp: -1 });
  return sessions;
};

module.exports = {
  // Patient operations
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  // Doctor operations
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  // Pharmacist operations
  getAllPharmacists,
  getPharmacistById,
  updatePharmacist,
  deletePharmacist,
  // Session operations
  getAllSessions,
};
