const express = require('express');
const multer  = require('multer');
const { verifyJWT, checkRole } = require('../middleware/auth.middleware');
const { runVoicePipeline }    = require('../services/voice_pipeline.service');
const { translateClinicalNote } = require('../ai_services/translate');
const {
  getMyProfile,
  updateDoctorProfile,
  getAllDoctors,
  getDoctorSessions,
  getDoctorPatients,
  startSessionAfterQrScan,
  getPatientHistory,
  saveDraft,
  finalizeConsultation,
  editConsultation,
  getConsultation,
  getDraftSessions,
} = require('../services/doctor.service');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

// All routes require authentication
router.use(verifyJWT);

/**
 * @swagger
 * /doctor/all:
 *   get:
 *     tags: [Doctor]
 *     summary: Get all doctors
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Doctors list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Doctor'
 */
router.get('/all', async (req, res, next) => {
  try {
    const doctors = await getAllDoctors();
    res.status(200).json({
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/profile:
 *   get:
 *     tags: [Doctor]
 *     summary: Get doctor profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 */
router.get('/profile', checkRole('doctor'), async (req, res, next) => {
  try {
    const doctor = await getMyProfile(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Doctor profile retrieved successfully',
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/profile:
 *   put:
 *     tags: [Doctor]
 *     summary: Update doctor profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               languagesKnown:
 *                 type: array
 *                 items:
 *                   type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', checkRole('doctor'), async (req, res, next) => {
  try {
    const doctor = await updateDoctorProfile(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Doctor profile updated successfully',
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/draft-sessions:
 *   get:
 *     tags: [Doctor]
 *     summary: Get draft sessions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Draft sessions list
 */
router.get('/draft-sessions', checkRole('doctor'), async (req, res, next) => {
  try {
    const sessions = await getDraftSessions(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Draft sessions retrieved successfully',
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/sessions:
 *   get:
 *     tags: [Doctor]
 *     summary: Get doctor sessions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 */
router.get('/sessions', checkRole('doctor'), async (req, res, next) => {
  try {
    const sessions = await getDoctorSessions(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Sessions retrieved successfully',
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/patients:
 *   get:
 *     tags: [Doctor]
 *     summary: Get unique patients for doctor
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Patients list
 */
router.get('/patients', checkRole('doctor'), async (req, res, next) => {
  try {
    const patients = await getDoctorPatients(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Patients retrieved successfully',
      data: patients,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/patient/{patientId}/history:
 *   get:
 *     tags: [Doctor]
 *     summary: Get patient history (records + prescriptions)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patient history
 *       404:
 *         description: Patient not found
 */
router.get('/patient/:patientId/history', checkRole('doctor'), async (req, res, next) => {
  try {
    const result = await getPatientHistory(req.user.id, req.params.patientId);
    res.status(200).json({
      success: true,
      message: 'Patient history retrieved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/scan-patient:
 *   post:
 *     tags: [Doctor]
 *     summary: Start session after QR scan
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session started
 */
router.post('/scan-patient', checkRole('doctor'), async (req, res, next) => {
  try {
    const { patientId, phoneNumber } = req.body;
    const result = await startSessionAfterQrScan(req.user.id, patientId, phoneNumber);
    res.status(200).json({
      success: true,
      message: 'Session started successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/consultation/draft:
 *   post:
 *     tags: [Doctor]
 *     summary: Save consultation draft
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *               soapNote:
 *                 type: object
 *               medicines:
 *                 type: array
 *                 items:
 *                   type: object
 *               icd10Codes:
 *                 type: array
 *                 items:
 *                   type: object
 *               vitals:
 *                 $ref: '#/components/schemas/Vitals'
 *     responses:
 *       200:
 *         description: Draft saved
 *       400:
 *         description: sessionId is required
 */
router.post('/consultation/draft', checkRole('doctor'), async (req, res, next) => {
  try {
    const { sessionId, soapNote, medicines, icd10Codes, vitals } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }
    const result = await saveDraft(req.user.id, sessionId, { soapNote, medicines, icd10Codes, vitals });
    res.status(200).json({
      success: true,
      message: 'Draft saved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/consultation/finalize:
 *   post:
 *     tags: [Doctor]
 *     summary: Finalize consultation
 *     description: Saves SOAP note, prescription, and closes the session.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *               soapNote:
 *                 type: object
 *               medicines:
 *                 type: array
 *                 items:
 *                   type: object
 *               icd10Codes:
 *                 type: array
 *                 items:
 *                   type: object
 *               vitals:
 *                 $ref: '#/components/schemas/Vitals'
 *     responses:
 *       200:
 *         description: Consultation finalized
 */
router.post('/consultation/finalize', checkRole('doctor'), async (req, res, next) => {
  try {
    const { sessionId, soapNote, medicines, icd10Codes, vitals } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }
    const result = await finalizeConsultation(req.user.id, sessionId, { soapNote, medicines, icd10Codes, vitals });
    res.status(200).json({
      success: true,
      message: 'Consultation finalized successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/consultation/{sessionId}:
 *   get:
 *     tags: [Doctor]
 *     summary: Get consultation details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consultation details
 *       404:
 *         description: Not found
 */
router.get('/consultation/:sessionId', checkRole('doctor'), async (req, res, next) => {
  try {
    const result = await getConsultation(req.params.sessionId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Consultation retrieved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /doctor/consultation/{prescriptionId}/edit:
 *   put:
 *     tags: [Doctor]
 *     summary: Edit consultation
 *     description: Updates an existing consultation and maintains edit history.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: prescriptionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               soapNote:
 *                 type: object
 *               medicines:
 *                 type: array
 *                 items:
 *                   type: object
 *               icd10Codes:
 *                 type: array
 *                 items:
 *                   type: object
 *               vitals:
 *                 $ref: '#/components/schemas/Vitals'
 *               editNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Consultation updated
 */
router.put('/consultation/:prescriptionId/edit', checkRole('doctor'), async (req, res, next) => {
  try {
    const { soapNote, medicines, icd10Codes, vitals, editNote } = req.body;
    const result = await editConsultation(req.user.id, req.params.prescriptionId, {
      soapNote,
      medicines,
      icd10Codes,
      vitals,
      editNote,
    });
    res.status(200).json({
      success: true,
      message: 'Consultation updated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Voice Pipeline ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/doctor/voice/process
 * Accepts a recorded audio file from the doctor's client and runs the full
 * AI pipeline: STT + diarization → LangGraph SOAP / vitals / ICD-10 /
 * prescription → saves Transcript + updates Session draft.
 *
 * Body (multipart/form-data):
 *   audio         {File}    Required. WAV/MP3/M4A recording.
 *   sessionId     {string}  Required. MongoDB _id or sessionId of the session.
 *   language_code {string}  Optional. Default "en-IN".
 */
/**
 * @swagger
 * /doctor/voice/process:
 *   post:
 *     tags: [Doctor]
 *     summary: Run voice AI pipeline
 *     description: Accepts recorded audio and runs STT + diarization + LangGraph SOAP pipeline. Saves Transcript and updates Session draft.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio, sessionId]
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *               sessionId:
 *                 type: string
 *               language_code:
 *                 type: string
 *                 default: en-IN
 *     responses:
 *       200:
 *         description: Voice pipeline completed, draft saved
 *       400:
 *         description: Missing audio or sessionId
 */
router.post(
  '/voice/process',
  checkRole('doctor'),
  upload.single('audio'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return next(Object.assign(new Error('audio file is required'), { statusCode: 400 }));
      }
      const { sessionId, language_code } = req.body;
      if (!sessionId) {
        return next(Object.assign(new Error('sessionId is required'), { statusCode: 400 }));
      }

      const result = await runVoicePipeline(
        req.file.buffer,
        req.file.originalname,
        sessionId,
        req.user.id,
        { language_code: language_code || 'en-IN' }
      );

      res.status(200).json({
        success: true,
        message: 'Voice pipeline completed. Draft saved — review and finalize.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/doctor/voice/translate
 * Translates a clinical SOAP note to a patient-friendly summary in the
 * requested language. Uses Gemini (simplification) + Sarvam AI (translation).
 *
 * Body (JSON):
 *   soapNote       {object}  Required. { subjective, objective, assessment, plan }
 *   targetLanguage {string}  Optional. Language name or BCP-47 code. Default "en-IN".
 *   patientName    {string}  Optional.
 *   icdCodes       {Array}   Optional.
 *   prescription   {Array}   Optional.
 */
/**
 * @swagger
 * /doctor/voice/translate:
 *   post:
 *     tags: [Doctor]
 *     summary: Translate clinical note
 *     description: Translates a SOAP note to a patient-friendly summary in the requested language using Gemini + Sarvam AI.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [soapNote]
 *             properties:
 *               soapNote:
 *                 type: object
 *                 properties:
 *                   subjective:
 *                     type: string
 *                   objective:
 *                     type: string
 *                   assessment:
 *                     type: string
 *                   plan:
 *                     type: string
 *               targetLanguage:
 *                 type: string
 *                 default: en-IN
 *               patientName:
 *                 type: string
 *               icdCodes:
 *                 type: array
 *                 items:
 *                   type: object
 *               prescription:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Note translated
 *       400:
 *         description: soapNote object is required
 */
router.post('/voice/translate', checkRole('doctor'), async (req, res, next) => {
  try {
    const { soapNote, targetLanguage, patientName, icdCodes, prescription } = req.body;
    if (!soapNote || typeof soapNote !== 'object') {
      return next(Object.assign(new Error('soapNote object is required'), { statusCode: 400 }));
    }

    const result = await translateClinicalNote(
      soapNote,
      targetLanguage || 'en-IN',
      { patientName, icdCodes, prescription }
    );

    res.status(200).json({
      success: true,
      message: 'Clinical note translated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
