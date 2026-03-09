const express = require('express');
const multer = require('multer');
const {
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
} = require('../services/auth.service');
const { synthesizeSpeech } = require('../ai_services/text_to_speech');
const PatientModel    = require('../models/Patient.model');
const DoctorModel     = require('../models/Doctor.model');
const PharmacistModel = require('../models/Pharmacist.model');
const AdminModel      = require('../models/Admin.model');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /auth/check-availability:
 *   post:
 *     tags: [Auth]
 *     summary: Check email / phone uniqueness
 *     description: Checks if the given email or phone number is already registered across all user models.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Availability result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailTaken:
 *                       type: boolean
 *                     phoneTaken:
 *                       type: boolean
 */
// POST /api/v1/auth/check-availability — check email / phone uniqueness before form submit
router.post('/check-availability', async (req, res, next) => {
  try {
    const { email, phoneNumber } = req.body;
    const ALL_MODELS = [PatientModel, DoctorModel, PharmacistModel, AdminModel];
    const result = { emailTaken: false, phoneTaken: false };

    if (email) {
      const normalised = email.trim().toLowerCase();
      for (const Model of ALL_MODELS) {
        if (await Model.findOne({ email: normalised }).lean()) { result.emailTaken = true; break; }
      }
    }

    if (phoneNumber) {
      const normalised = phoneNumber.trim();
      for (const Model of ALL_MODELS) {
        if (await Model.findOne({ phoneNumber: normalised }).lean()) { result.phoneTaken = true; break; }
      }
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/doctor:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new doctor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, dob, specialization]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               dob:
 *                 type: string
 *                 description: DD-MM-YYYY
 *               specialization:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               languagesKnown:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Doctor account created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 */
router.post('/register/doctor', async (req, res, next) => {
  try {
    const doctor = await createDoctor(req.body);
    res.status(201).json({ success: true, message: 'Doctor account created', data: doctor });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/patient:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new patient
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, gender, bloodGroup, phoneNumber, dob]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *               bloodGroup:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *               phoneNumber:
 *                 type: string
 *               dob:
 *                 type: string
 *                 description: DD-MM-YYYY
 *               languagesKnown:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Patient account created
 *       400:
 *         description: Validation error
 */
router.post('/register/patient', async (req, res, next) => {
  try {
    const patient = await createPatient(req.body);
    res.status(201).json({ success: true, message: 'Patient account created', data: patient });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/patient/voice:
 *   post:
 *     tags: [Auth]
 *     summary: Voice signup - transcribe audio
 *     description: Accepts an audio file and returns the transcribed text for patient signup.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio]
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *               language_code:
 *                 type: string
 *                 default: en-IN
 *     responses:
 *       200:
 *         description: Audio transcribed
 *       400:
 *         description: No audio file provided
 */
router.post('/register/patient/voice', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      const err = Object.assign(new Error('No audio file provided'), { statusCode: 400 });
      return next(err);
    }
    const languageCode = req.body.language_code || 'en-IN';
    const result = await signupPatientVoice(req.file.buffer, req.file.originalname, languageCode);
    res.status(200).json({ success: true, message: 'Audio transcribed successfully', data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/patient/voice-register:
 *   post:
 *     tags: [Auth]
 *     summary: Complete voice signup registration
 *     description: Creates a patient account from voice-transcribed data and sends activation email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               gender:
 *                 type: string
 *               bloodGroup:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               dob:
 *                 type: string
 *               languagesKnown:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Patient account created, activation email sent
 *       400:
 *         description: Validation error
 */
router.post('/register/patient/voice-register', async (req, res, next) => {
  try {
    const { patient } = await registerPatientVoice(req.body);
    res.status(201).json({
      success: true,
      message: 'Patient account created. Please check your email to activate your account and set your password.',
      data: { patient },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/pharmacist:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new pharmacist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, designation, phoneNumber]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               designation:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Pharmacist account created
 *       400:
 *         description: Validation error
 */
router.post('/register/pharmacist', async (req, res, next) => {
  try {
    const pharmacist = await createPharmacist(req.body);
    res.status(201).json({ success: true, message: 'Pharmacist account created', data: pharmacist });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/admin:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Admin account created
 *       400:
 *         description: Validation error
 */
router.post('/register/admin', async (req, res, next) => {
  try {
    const admin = await createAdmin(req.body);
    res.status(201).json({ success: true, message: 'Admin account created', data: admin });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: Authenticates a user and returns JWT access token. Sets refresh token as HTTP-only cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await login(req.body);
    
    // Set refresh token as HTTP-only cookie.
    // sameSite: 'none' is required in production because the frontend and backend
    // are on different CloudFront domains (cross-site). 'none' MUST be paired
    // with secure: true or the browser will reject the cookie entirely.
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken,
        // Also return the refresh token in the body so the frontend can store
        // it as a fallback for cross-origin environments (e.g. CloudFront) where
        // sameSite=none cookies may not arrive on the first request.
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Uses the refresh token (from cookie or body) to issue a new access token.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    const { accessToken, user } = await refreshAccessToken(refreshToken);
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken, user },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/tts:
 *   post:
 *     tags: [Auth]
 *     summary: Text-to-speech
 *     description: Synthesizes speech from text using Sarvam AI (Hindi/Telugu/English).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *               language_code:
 *                 type: string
 *                 default: en-IN
 *               speaker:
 *                 type: string
 *     responses:
 *       200:
 *         description: Speech synthesized
 *       400:
 *         description: text is required
 */
router.post('/tts', async (req, res, next) => {
  try {
    const { text, language_code, speaker } = req.body;
    if (!text) {
      return next(Object.assign(new Error('text is required'), { statusCode: 400 }));
    }
    const result = await synthesizeSpeech(text, language_code || 'en-IN', speaker);
    res.status(200).json({ success: true, message: 'Speech synthesized', data: result });
  } catch (err) {
    console.error('[TTS] Sarvam AI error:', err?.message, err?.body ?? err);
    next(err);
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout
 *     description: Clears the refresh token cookie.
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', async (req, res, next) => {
  try {
    // Mirror the same cookie options used at login so the browser correctly
    // clears the cross-site cookie in production.
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/request-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Sends a one-time password (OTP) to the user's email for password reset.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent
 *       400:
 *         description: email is required
 */
router.post('/request-reset', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(Object.assign(new Error('email is required'), { statusCode: 400 }));
    const result = await requestPasswordReset(email);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with OTP
 *     description: Verifies the OTP and sets a new password for the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Validation error
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return next(Object.assign(new Error('email, otp and newPassword are required'), { statusCode: 400 }));
    }
    if (newPassword.length < 8) {
      return next(Object.assign(new Error('newPassword must be at least 8 characters'), { statusCode: 400 }));
    }
    const result = await verifyOtpAndResetPassword(email, otp, newPassword);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
