const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateAccessToken, generateRefreshToken } = require('../utils/token.utils');
const { transcribeAudio, buildSignupTranscriptionPrompt } = require('../ai_services/speech_to_text');
const { formatTranscriptText } = require('../ai_services/text_formatter');
const { sendOtpEmail, sendSignupEmail, sendActivationEmail, sendWelcomeEmail } = require('../utils/mailer');

// ─── In-memory OTP store ──────────────────────────────────────────────────────
// Map<email, { otp: string, expires: number }>
const otpStore = new Map();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// Purge expired OTPs lazily
const purgeExpiredOtps = () => {
  const now = Date.now();
  for (const [email, entry] of otpStore) {
    if (entry.expires < now) otpStore.delete(email);
  }
};

/**
 * Generate a secure 16-char temp password (used for all personas at signup;
 * replaced immediately when the user completes e-mail verification).
 */
const generateTempPassword = () => {
  const pool = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  const bytes = crypto.randomBytes(16);
  let pw = '';
  for (let i = 0; i < 16; i++) pw += pool[bytes[i] % pool.length];
  return pw;
};

/**
 * Derive a 2-char language code ('en'|'hi'|'te') from languagesKnown array or explicit override.
 */
const langFromKnown = (languagesKnown = [], explicitLang) => {
  if (explicitLang && ['en', 'hi', 'te'].includes(explicitLang)) return explicitLang;
  const first = (languagesKnown[0] || '').toLowerCase();
  if (first === 'hindi'   || first.startsWith('hi')) return 'hi';
  if (first === 'telugu'  || first.startsWith('te')) return 'te';
  return 'en';
};

/**
 * Store an activation OTP for the given email (24-hour TTL) and return the OTP.
 * Using a longer TTL than regular password-reset OTPs because users may not
 * check their email instantly after registering.
 */
const issueActivationOtp = (email) => {
  purgeExpiredOtps();
  const normalised = email.trim().toLowerCase();
  const otp = generateOtp();
  otpStore.set(normalised, { otp, expires: Date.now() + 24 * 60 * 60 * 1000 }); // 24 h
  return otp;
};

/**
 * Check that an email address does not exist in ANY persona collection.
 * Throws 409 Conflict if a match is found.
 */
const checkEmailAllModels = async (email, skipRole) => {
  // skipRole lets us skip checking the model that is currently being created
  const checks = [
    { Model: Patient,    role: 'patient'    },
    { Model: Doctor,     role: 'doctor'     },
    { Model: Pharmacist, role: 'pharmacist' },
    { Model: Admin,      role: 'admin'      },
  ].filter(({ role }) => role !== skipRole);

  const normalised = email.trim().toLowerCase();
  for (const { Model, role } of checks) {
    const exists = await Model.findOne({ email: normalised }).lean();
    if (exists) {
      throw Object.assign(
        new Error(`This email is already registered as a ${role}. Please use a different email address.`),
        { statusCode: 409 }
      );
    }
  }
};


const Doctor = require('../models/Doctor.model');
const Patient = require('../models/Patient.model');
const Pharmacist = require('../models/Pharmacist.model');
const Admin = require('../models/Admin.model');
const { validateDOB } = require('../utils/validation.utils');

/**
 * HMAC-SHA256 the raw password with USER_SECRET_KEY before bcrypt (in model pre-save hook)
 * This adds a server-side secret layer on top of bcrypt.
 */
const applySecretHash = (password) => {
  const secret = process.env.USER_SECRET_KEY;
  if (!secret) throw new Error('USER_SECRET_KEY is not set in environment');
  return crypto.createHmac('sha256', secret).update(password).digest('hex');
};

// ─── Create Doctor ─────────────────────────────────────────────────────────────
const createDoctor = async ({
  name,
  email,
  dob,
  specialization,
  phoneNumber,
  languagesKnown,
  preferredLanguage,
}) => {
  const normalised = (email || '').trim().toLowerCase();
  // Ensure email is not registered in any persona
  await checkEmailAllModels(normalised);

  // Validate DOB is not in the future
  const dobCheck = validateDOB(dob);
  if (!dobCheck.valid) throw Object.assign(new Error(dobCheck.error), { statusCode: 400 });

  const tempPassword = generateTempPassword();

  const lang = langFromKnown(languagesKnown, preferredLanguage);

  const doctor = new Doctor({
    doctorId: `DOC-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email: normalised,
    password: applySecretHash(tempPassword),
    dob,
    specialization,
    phoneNumber: phoneNumber || null,
    languagesKnown: languagesKnown || [],
    preferredLanguage: lang,
    isVerified: false,
  });

  await doctor.save();

  // Send signup notification email (no OTP — OTP is issued when user clicks Activate)
  try {
    await sendSignupEmail(normalised, name, 'doctor', lang);
  } catch (mailErr) {
    console.error('[mailer] Failed to send doctor signup email:', mailErr.message);
  }

  const result = doctor.toObject();
  delete result.password;
  return result;
};

// ─── Create Patient ────────────────────────────────────────────────────────────
const createPatient = async ({
  name,
  email,
  gender,
  bloodGroup,
  phoneNumber,
  dob,
  languagesKnown,
  preferredLanguage,
  emergencyContacts,
}) => {
  const normalised = (email || '').trim().toLowerCase();
  if (!normalised) throw Object.assign(new Error('Email is required'), { statusCode: 400 });

  // Ensure email is unique across ALL personas
  await checkEmailAllModels(normalised);

  // Validate DOB is not in the future
  const dobCheck = validateDOB(dob);
  if (!dobCheck.valid) throw Object.assign(new Error(dobCheck.error), { statusCode: 400 });

  const lang = langFromKnown(languagesKnown, preferredLanguage);
  const tempPassword = generateTempPassword();

  const patient = new Patient({
    patientId: `PAT-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email: normalised,
    password: applySecretHash(tempPassword),
    gender,
    bloodGroup,
    phoneNumber,
    dob,
    languagesKnown: languagesKnown || [],
    preferredLanguage: lang,
    isVerified: false,
    emergencyContacts: emergencyContacts || [],
  });

  await patient.save();

  // Send signup notification email in patient's language (no OTP — issued on Activate click)
  try {
    await sendSignupEmail(normalised, name, 'patient', lang);
  } catch (mailErr) {
    console.error('[mailer] Failed to send patient signup email:', mailErr.message);
  }

  const result = patient.toObject();
  delete result.password;
  return result;
};

// ─── Create Pharmacist ─────────────────────────────────────────────────────────
const createPharmacist = async ({
  name,
  email,
  designation,
  phoneNumber,
  languagesKnown,
  preferredLanguage,
}) => {
  const normalised = (email || '').trim().toLowerCase();
  await checkEmailAllModels(normalised);

  const tempPassword = generateTempPassword();
  const lang = langFromKnown(languagesKnown, preferredLanguage);

  const pharmacist = new Pharmacist({
    pharmacistId: `PHA-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email: normalised,
    password: applySecretHash(tempPassword),
    designation,
    phoneNumber,
    languagesKnown: languagesKnown || [],
    preferredLanguage: lang,
    isVerified: false,
  });

  await pharmacist.save();
  try {
    await sendSignupEmail(normalised, name, 'pharmacist', lang);
  } catch (mailErr) {
    console.error('[mailer] Failed to send pharmacist signup email:', mailErr.message);
  }

  const result = pharmacist.toObject();
  delete result.password;
  return result;
};

// ─── Create Admin ──────────────────────────────────────────────────────────────
const createAdmin = async ({ name, email }) => {
  const normalised = (email || '').trim().toLowerCase();
  await checkEmailAllModels(normalised);

  const tempPassword = generateTempPassword();

  const admin = new Admin({
    adminId: `ADM-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email: normalised,
    password: applySecretHash(tempPassword),
    isVerified: false,
  });

  await admin.save();

  try {
    await sendSignupEmail(normalised, name, 'admin', 'en');
  } catch (mailErr) {
    console.error('[mailer] Failed to send admin signup email:', mailErr.message);
  }

  const result = admin.toObject();
  delete result.password;
  return result;
};

// ─── Login (Universal) ─────────────────────────────────────────────────────────
const login = async ({ identifier, email: legacyEmail, password }) => {
  // Support both identifier (email or phone) and legacy email field
  const id = (identifier || legacyEmail || '').trim();
  // Detect if identifier looks like a phone number (digits only, 10 digits)
  const isPhone = /^\d{7,15}$/.test(id);
  const query = isPhone ? { phoneNumber: id } : { $or: [{ email: id.toLowerCase() }, { email: id }] };

  // Try to find user in all collections
  const models = [
    { Model: Patient, role: 'patient' },
    { Model: Doctor, role: 'doctor' },
    { Model: Pharmacist, role: 'pharmacist' },
    { Model: Admin, role: 'admin' },
  ];

  let user = null;
  let role = null;
  console.log("Attempting login for identifier:", id);

  for (const { Model, role: userRole } of models) {
    user = await Model.findOne(query).select('+password +refreshToken');
    if (user) {
      role = userRole;
      break;
    }
  }

  if (!user) {
    throw Object.assign(new Error('Invalid email/phone/phone or password'), { statusCode: 401 });
  }

  // Block unverified accounts — user must complete email verification first
  if (user.isVerified === false) {
    throw Object.assign(
      new Error('Your account is not yet verified. Please check your email for the activation code and set your password.'),
      { statusCode: 403, code: 'UNVERIFIED' }
    );
  }

  // Compare hashed password
  const hashedPassword = applySecretHash(password);
  const isMatch = await user.comparePassword(hashedPassword);

  if (!isMatch) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  // Generate tokens
  const payload = {
    id: user._id,
    email: user.email,
    role,
    name: user.name,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Save refresh token to database
  user.refreshToken = refreshToken;
  await user.save();

  // Return user data without sensitive fields
  const userData = user.toObject();
  delete userData.password;
  delete userData.refreshToken;

  return {

    user: { ...userData, role },
    accessToken,
    refreshToken,
  };
};

// ─── Refresh Access Token ──────────────────────────────────────────────────────
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw Object.assign(new Error('Refresh token required'), { statusCode: 401 });
  }

  const jwt = require('jsonwebtoken');
  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  // Find user based on role
  const models = [
    { Model: Patient, role: 'patient' },
    { Model: Doctor, role: 'doctor' },
    { Model: Pharmacist, role: 'pharmacist' },
    { Model: Admin, role: 'admin' },
  ];

  let user = null;
  for (const { Model, role } of models) {
    if (decoded.role === role) {
      user = await Model.findById(decoded.id).select('+refreshToken');
      break;
    }
  }

  if (!user || user.refreshToken !== refreshToken) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  // Generate new access token
  const payload = {
    id: user._id,
    email: user.email,
    role: decoded.role,
    name: user.name,
  };

  const newAccessToken = generateAccessToken(payload);

  // Return user data along with new token so frontend can restore session
  const userData = user.toObject();
  delete userData.password;
  delete userData.refreshToken;

  return { accessToken: newAccessToken, user: { ...userData, role: decoded.role } };
};

// ─── Request Password Reset (send OTP) ────────────────────────────────────────
/**
 * Looks up the email across all user types, generates a 6-digit OTP,
 * stores it (in-memory, 10-minute TTL) and sends it via email.
 * If the account is not yet verified, re-sends the branded activation email.
 */
const requestPasswordReset = async (email) => {
  purgeExpiredOtps();
  const normalised = (email || '').trim().toLowerCase();

  const personaMap = [
    { Model: Patient,    role: 'patient'    },
    { Model: Doctor,     role: 'doctor'     },
    { Model: Pharmacist, role: 'pharmacist' },
    { Model: Admin,      role: 'admin'      },
  ];

  let foundUser = null;
  let foundRole = null;
  for (const { Model, role } of personaMap) {
    const user = await Model.findOne({ email: normalised });
    if (user) { foundUser = user; foundRole = role; break; }
  }

  if (!foundUser) {
    throw Object.assign(
      new Error('No account found with this email address. Please check the email or sign up first.'),
      { statusCode: 404 }
    );
  }

  const otp = generateOtp();
  otpStore.set(normalised, { otp, expires: Date.now() + 10 * 60 * 1000 }); // 10 min

  // Derive preferred language for any persona
  const userLang = (() => {
    if (foundUser.preferredLanguage) return foundUser.preferredLanguage;
    if (foundUser.languagesKnown) return langFromKnown(foundUser.languagesKnown);
    return 'en';
  })();

  if (!foundUser.isVerified) {
    // Resend branded activation email so unverified users can complete setup
    await sendActivationEmail(normalised, foundUser.name, otp, foundRole, userLang);
    return { message: 'OTP sent to your email address.', lang: userLang };
  } else {
    await sendOtpEmail(normalised, otp, userLang);
    return { message: 'OTP sent to your email address.', alreadyVerified: true, lang: userLang };
  }
};

// ─── Verify OTP and Reset Password ────────────────────────────────────────────
const verifyOtpAndResetPassword = async (email, otp, newPassword) => {
  purgeExpiredOtps();
  const normalised = (email || '').trim().toLowerCase();

  const entry = otpStore.get(normalised);
  if (!entry) {
    throw Object.assign(new Error('No OTP found for this email. Please request a new one.'), { statusCode: 400 });
  }
  if (Date.now() > entry.expires) {
    otpStore.delete(normalised);
    throw Object.assign(new Error('OTP has expired. Please request a new one.'), { statusCode: 400 });
  }
  if (entry.otp !== String(otp).trim()) {
    throw Object.assign(new Error('Invalid OTP. Please check and try again.'), { statusCode: 400 });
  }

  // OTP is valid — update password across all models
  let updated = false;
  let welcomeName = null;
  let welcomePersona = null;
  let welcomeLang = 'en';

  const personaMap = [
    { Model: Patient,    role: 'patient'    },
    { Model: Doctor,     role: 'doctor'     },
    { Model: Pharmacist, role: 'pharmacist' },
    { Model: Admin,      role: 'admin'      },
  ];

  for (const { Model, role } of personaMap) {
    const user = await Model.findOne({ email: normalised }).select('+password');
    if (user) {
      user.password  = applySecretHash(newPassword);
      user.isVerified = true;
      await user.save();
      updated       = true;
      welcomeName   = user.name;
      welcomePersona = role;
      welcomeLang   = user.preferredLanguage || langFromKnown(user.languagesKnown || []);
      break;
    }
  }

  if (!updated) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  otpStore.delete(normalised);

  // Send persona-specific, language-aware welcome email (non-blocking)
  if (welcomeName && welcomePersona) {
    sendWelcomeEmail(normalised, welcomeName, welcomePersona, welcomeLang).catch((err) =>
      console.error('[mailer] Failed to send welcome email:', err.message)
    );
  }

  return { message: 'Password set successfully. Your account is now active.' };
};

// ─── Register Patient via Voice ────────────────────────────────────────────────
/**
 * Creates a patient account from details collected via a voice conversation.
 * A temp password is generated server-side; the user activates by email OTP.
 *
 * @param {{ name, email, phoneNumber, dob, gender, bloodGroup, languagesKnown, preferredLanguage, emergencyContacts }} payload
 * @returns {Promise<{ patient: object }>}
 */
const registerPatientVoice = async ({
  name,
  email: emailParam,
  phoneNumber,
  dob,
  gender,
  bloodGroup,
  languagesKnown,
  preferredLanguage,
  emergencyContacts,
}) => {
  if (!emailParam) {
    throw Object.assign(new Error('Email address is required for voice signup'), { statusCode: 400 });
  }

  const normalised = emailParam.trim().toLowerCase();

  // Ensure email is unique across ALL personas
  await checkEmailAllModels(normalised);

  const existingPhone = await Patient.findOne({ phoneNumber });
  if (existingPhone) throw Object.assign(new Error('A patient with this phone number already exists'), { statusCode: 409 });

  // Validate DOB is not in the future
  const dobCheck = validateDOB(dob);
  if (!dobCheck.valid) throw Object.assign(new Error(dobCheck.error), { statusCode: 400 });

  const lang = langFromKnown(languagesKnown, preferredLanguage);
  const tempPassword = generateTempPassword();

  const patient = new Patient({
    patientId: `PAT-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email: normalised,
    password: applySecretHash(tempPassword),
    gender: gender || 'prefer_not_to_say',
    bloodGroup: bloodGroup || 'B+',
    phoneNumber,
    dob,
    languagesKnown: languagesKnown || [],
    preferredLanguage: lang,
    isVerified: false,
    emergencyContacts: emergencyContacts || [],
  });

  await patient.save();

  // Send signup notification email (no OTP — issued when user clicks Activate)
  try {
    await sendSignupEmail(normalised, name, 'patient', lang);
  } catch (mailErr) {
    console.error('[mailer] Failed to send voice patient signup email:', mailErr.message);
  }

  const result = patient.toObject();
  delete result.password;
  return { patient: result };
};

// ─── Signup Patient via Voice ─────────────────────────────────────────────────
/**
 * Accepts a raw audio buffer (from multipart upload), writes it to a temp file,
 * transcribes it via Sarvam AI, formats the transcript to keep English words/numbers in English,
 * then deletes the temp file.
 *
 * @param {Buffer} audioBuffer - Raw audio bytes
 * @param {string} [originalName="audio.wav"] - Original filename to infer mime type
 * @returns {Promise<{
 *   request_id: string,
 *   transcript: string,
 *   formatted_transcript: string,
 *   timestamps: object|null,
 *   diarized_transcript: object|null,
 *   language_code: string,
 *   language_probability: number
 * }>}
 */
const signupPatientVoice = async (audioBuffer, originalName = 'audio.wav', languageCode = 'en-IN') => {
  const ext = originalName.toLowerCase().endsWith('.mp3') ? '.mp3' : '.wav';
  const tmpPath = path.join(os.tmpdir(), `voice_${Date.now()}${ext}`);

  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    // Step 1: Transcribe the audio with the user's selected language and a structured
    // formatting prompt so Sarvam AI returns phone/gender/dob in the expected format.
    const prompt = buildSignupTranscriptionPrompt(languageCode);
    const result = await transcribeAudio(tmpPath, { language_code: languageCode, prompt });
    
    // Step 2: Format the transcript to ensure English words and numbers stay in English
    const formattedTranscript = await formatTranscriptText(
      result.transcript,
      result.language_code
    );

    // Return both original and formatted transcripts
    return {
      ...result,
      formatted_transcript: formattedTranscript,
    };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore cleanup errors */ }
  }
};

module.exports = {
  createDoctor,
  createPatient,
  createPharmacist,
  createAdmin,
  login,
  refreshAccessToken,
  signupPatientVoice,
  registerPatientVoice,
  requestPasswordReset,
  verifyOtpAndResetPassword,
};
