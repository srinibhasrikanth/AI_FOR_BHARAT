const express = require('express');
const multer  = require('multer');
const { verifyJWT, checkRole } = require('../middleware/auth.middleware');
const {
  getMyProfile,
  updatePatientProfile,
  getPatientRecords,
  getPatientLabReports,
  getPatientPrescriptions,
  getPatientSessions,
  getPatientConsultation,
} = require('../services/patient.service');
const { handleChatMessage, getWelcomeMessage, analyzeImageForDiagnosis } = require('../services/chatbot.service');
const Patient = require('../models/Patient.model');
const Record = require('../models/Record.model');
const Prescription = require('../models/Prescription.model');
const Medicine = require('../models/Medicine.model');
const { digitizePrescription } = require('../services/prescription_digitizer.service');
const {
  createPharmacyOrder,
  verifyAndPayOrder,
  getPatientOrders,
} = require('../services/order.service');

// multer — memory storage, images only, no size limit
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') return cb(null, true);
    cb(Object.assign(new Error('Only image or PDF files are accepted'), { statusCode: 400 }));
  },
});

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

/**
 * @swagger
 * /patient/profile:
 *   get:
 *     tags: [Patient]
 *     summary: Get patient profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Patient'
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', checkRole('patient'), async (req, res, next) => {
  try {
    const patient = await getMyProfile(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Patient profile retrieved successfully',
      data: patient,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/profile:
 *   put:
 *     tags: [Patient]
 *     summary: Update patient profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emergencyContacts:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/EmergencyContact'
 *               languagesKnown:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', checkRole('patient'), async (req, res, next) => {
  try {
    const patient = await updatePatientProfile(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      data: patient,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/records:
 *   get:
 *     tags: [Patient]
 *     summary: Get patient health records
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Records retrieved
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
 *                     $ref: '#/components/schemas/Record'
 *       401:
 *         description: Unauthorized
 */
router.get('/records', checkRole('patient'), async (req, res, next) => {
  try {
    const records = await getPatientRecords(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Records retrieved successfully',
      data: records,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/lab-reports:
 *   get:
 *     tags: [Patient]
 *     summary: Get patient lab reports
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lab reports retrieved
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
 *                     $ref: '#/components/schemas/LabReport'
 *       401:
 *         description: Unauthorized
 */
router.get('/lab-reports', checkRole('patient'), async (req, res, next) => {
  try {
    const labReports = await getPatientLabReports(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Lab reports retrieved successfully',
      data: labReports,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/prescriptions:
 *   get:
 *     tags: [Patient]
 *     summary: Get patient prescriptions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Prescriptions retrieved
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
 *                     $ref: '#/components/schemas/Prescription'
 *       401:
 *         description: Unauthorized
 */
router.get('/prescriptions', checkRole('patient'), async (req, res, next) => {
  try {
    const prescriptions = await getPatientPrescriptions(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Prescriptions retrieved successfully',
      data: prescriptions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/sessions:
 *   get:
 *     tags: [Patient]
 *     summary: Get patient consultation sessions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved
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
 *       401:
 *         description: Unauthorized
 */
router.get('/sessions', checkRole('patient'), async (req, res, next) => {
  try {
    const sessions = await getPatientSessions(req.user.id);
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
 * /patient/consultation/{sessionId}:
 *   get:
 *     tags: [Patient]
 *     summary: Get consultation details for a session
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
 *         description: Consultation retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 */
router.get('/consultation/:sessionId', checkRole('patient'), async (req, res, next) => {
  try {
    const result = await getPatientConsultation(req.params.sessionId, req.user.id);
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
 * /patient/prescription/digitize:
 *   post:
 *     tags: [Patient]
 *     summary: Upload a prescription image for AI digitization
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Prescription digitized successfully
 *       400:
 *         description: No image provided or invalid file type
 *       401:
 *         description: Unauthorized
 */
/**
 * @swagger
 * /patient/chatbot/welcome:
 *   get:
 *     tags: [Patient]
 *     summary: Get chatbot welcome message
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           enum: [en, hi, te]
 *     responses:
 *       200:
 *         description: Welcome message returned
 *       401:
 *         description: Unauthorized
 */
router.get('/chatbot/welcome', checkRole('patient'), async (req, res, next) => {
  try {
    const language = req.query.language || 'en';
    const patient = await Patient.findById(req.user.id).select('name').lean();
    const result = getWelcomeMessage(language, patient?.name);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/chatbot:
 *   post:
 *     tags: [Patient]
 *     summary: Send message to health chatbot
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                     content:
 *                       type: string
 *               language:
 *                 type: string
 *                 enum: [en, hi, te]
 *     responses:
 *       200:
 *         description: AI reply returned
 *       401:
 *         description: Unauthorized
 */
router.post('/chatbot', checkRole('patient'), async (req, res, next) => {
  const t0 = Date.now();
  console.log('[POST /chatbot] user:', req.user?.id, '| body keys:', Object.keys(req.body));
  try {
    const { messages, language = 'en' } = req.body;
    console.log('[POST /chatbot] language:', language, '| messages count:', messages?.length);

    // Fetch patient base profile
    const patient = await Patient.findById(req.user.id)
      .select('name gender bloodGroup dob preferredLanguage')
      .lean();
    console.log('[POST /chatbot] patient found:', !!patient, '| name:', patient?.name);

    // Fetch recent records to derive conditions and current medicines
    const records = await Record.find({ patientId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(5)
      .populate('medicines.medicineId', 'name dosage')
      .lean();
    console.log('[POST /chatbot] records found:', records.length);

    // Extract unique diagnosed conditions from records
    const conditions = [
      ...new Set(
        records
          .map((r) => r.diagnosedComplaint)
          .filter(Boolean)
      ),
    ];

    // Extract medicines from the most recent unresolved record (or latest)
    const activeRecord = records.find((r) => !r.isResolved) || records[0];
    const medicines = (activeRecord?.medicines || [])
      .filter((m) => m.medicineId)
      .map((m) => ({
        name: m.medicineId.name,
        dosage: m.medicineId.dosage,
        frequency: m.time?.join(', ') || '',
      }));

    // Calculate age from dob
    let age;
    if (patient?.dob) {
      const birthYear = new Date(patient.dob).getFullYear();
      age = new Date().getFullYear() - birthYear;
    }

    const patientContext = {
      name: patient?.name || 'Patient',
      age,
      gender: patient?.gender,
      bloodGroup: patient?.bloodGroup,
      conditions,
      allergies: [],
      medicines,
      preferredLanguage: patient?.preferredLanguage || language,
    };

    const result = await handleChatMessage({ messages, patientContext, language });
    console.log('[POST /chatbot] success in', Date.now() - t0, 'ms');
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('[POST /chatbot] ERROR after', Date.now() - t0, 'ms:', err?.statusCode, err?.message);
    next(err);
  }
});

/**
 * @swagger
 * /patient/chatbot/analyze-image:
 *   post:
 *     tags: [Patient]
 *     summary: Analyse an uploaded image for medical/diagnostic conditions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               language:
 *                 type: string
 *                 enum: [en, hi, te]
 *     responses:
 *       200:
 *         description: Image diagnosis analysis returned
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/chatbot/analyze-image',
  checkRole('patient'),
  upload.single('image'),
  async (req, res, next) => {
    const t0 = Date.now();
    console.log('[POST /chatbot/analyze-image] user:', req.user?.id);
    try {
      const language = req.body.language || req.query.language || 'en';
      // userText is the patient's optional description/query about the image
      const userText = req.body.userText || '';

      // Only require userText when there is NO image and Gemini Vision is unavailable
      const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key';
      if (!req.file && !userText.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an image or describe what you see so Aarogya can analyse it.',
        });
      }
      if (!req.file && !hasGeminiKey && !userText.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please describe what you see in the image so Aarogya can analyse it.',
        });
      }

      // Fetch full patient context (same as /chatbot endpoint)
      const patient = await Patient.findById(req.user.id)
        .select('name gender bloodGroup dob conditions allergies preferredLanguage')
        .lean();

      // Fetch recent records for conditions and active medicines
      const records = await Record.find({ patientId: req.user.id })
        .sort({ timestamp: -1 })
        .limit(5)
        .populate('medicines.medicineId', 'name dosage')
        .lean();

      const conditions = [
        ...new Set(
          records
            .map((r) => r.diagnosedComplaint)
            .filter(Boolean)
        ),
        ...(patient?.conditions || []),
      ].filter((v, i, a) => a.indexOf(v) === i);

      const activeRecord = records.find((r) => !r.isResolved) || records[0];
      const medicines = (activeRecord?.medicines || [])
        .filter((m) => m.medicineId)
        .map((m) => ({
          name: m.medicineId.name,
          dosage: m.medicineId.dosage,
          frequency: m.time?.join(', ') || '',
        }));

      let age;
      if (patient?.dob) {
        age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
      }

      const patientContext = {
        name: patient?.name || 'Patient',
        age,
        gender: patient?.gender,
        bloodGroup: patient?.bloodGroup,
        conditions,
        allergies: patient?.allergies || [],
        medicines,
      };

      const result = await analyzeImageForDiagnosis({ imageFile: req.file, userText, language, patientContext });
      console.log('[POST /chatbot/analyze-image] success in', Date.now() - t0, 'ms | isDiagnosisRelated:', result.isDiagnosisRelated);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error('[POST /chatbot/analyze-image] ERROR after', Date.now() - t0, 'ms:', err?.statusCode, err?.message);
      next(err);
    }
  }
);

router.post(
  '/prescription/digitize',
  checkRole('patient'),
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided' });
      }
      const result = await digitizePrescription(
        req.file.buffer,
        req.file.mimetype,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: 'Prescription digitized successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /patient/medicines - browse available medicines (pharmacy shop)
router.get('/medicines', checkRole('patient'), async (req, res, next) => {
  try {
    const medicines = await Medicine.find({ quantity: { $gt: 0 } })
      .select('_id medicineId name dosage cost unit category quantity manufacturer description')
      .sort({ name: 1 })
      .lean();
    res.status(200).json({ success: true, data: medicines });
  } catch (err) {
    next(err);
  }
});

// ─── Pharmacy Order routes ─────────────────────────────────────────────────────

// POST /patient/orders - create a Razorpay order (patient initiates checkout)
router.post('/orders', checkRole('patient'), async (req, res, next) => {
  try {
    const result = await createPharmacyOrder(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Order created', data: result });
  } catch (err) {
    next(err);
  }
});

// POST /patient/orders/verify-payment - verify Razorpay payment & generate QR
router.post('/orders/verify-payment', checkRole('patient'), async (req, res, next) => {
  try {
    const order = await verifyAndPayOrder(req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Payment verified', data: order });
  } catch (err) {
    next(err);
  }
});

// GET /patient/orders - list patient's orders
router.get('/orders', checkRole('patient'), async (req, res, next) => {
  try {
    const orders = await getPatientOrders(req.user.id);
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// ─── Record Translation ────────────────────────────────────────────────────────

// POST /patient/records/translate
// Translates a single record's content into the patient's chosen language
// using the Sarvam AI pipeline (simplify medical jargon → translate).
router.post('/records/translate', checkRole('patient'), async (req, res, next) => {
  try {
    const {
      soapNote,
      complaint,
      diagnosedComplaint,
      icdCodes,
      consultationMedicines,
      patientName,
      targetLanguage,
    } = req.body;

    if (!targetLanguage || targetLanguage === 'en') {
      return res.status(400).json({ success: false, message: 'targetLanguage must be "hi" or "te"' });
    }

    const { translateClinicalNote } = require('../ai_services/translate');
    const { SarvamAIClient } = require('sarvamai');

    const langCode = targetLanguage === 'hi' ? 'hi-IN' : 'te-IN';

    // Full simplify-then-translate pipeline for the SOAP note
    let soap = null;
    if (soapNote && Object.values(soapNote).some(Boolean)) {
      const result = await translateClinicalNote(soapNote, langCode, {
        patientName: patientName || '',
        icdCodes: icdCodes || [],
        prescription: consultationMedicines || [],
      });
      soap = result.translated;
    }

    // For the complaint/diagnosis display:
    // - If we have a SOAP translation, use its summary as the complaint (it's already patient-friendly in the target language)
    // - For diagnosedComplaint, use the translated diagnosis field from the SOAP
    // - Only fall back to direct text translation for short strings (<= 400 chars)
    let translatedComplaint = complaint || '';
    let translatedDiagnosis = diagnosedComplaint || '';

    if (soap && soap.summary_translated) {
      // Use the SOAP-derived patient-friendly summary instead of translating the raw SOAP subjective
      translatedComplaint = soap.summary_translated;
      translatedDiagnosis = soap.diagnosis_translated || soap.diagnosis || translatedDiagnosis;
    } else if (process.env.SARVAM_API_KEY) {
      const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
      const translateText = async (text) => {
        if (!text || text.length > 400) return text; // skip overly long strings
        try {
          const resp = await client.text.translate({
            input: text,
            source_language_code: 'en-IN',
            target_language_code: langCode,
            speaker_gender: 'Female',
            mode: 'formal',
            model: 'mayura:v1',
            enable_preprocessing: true,
          });
          return resp.translated_text || text;
        } catch { return text; }
      };
      [translatedComplaint, translatedDiagnosis] = await Promise.all([
        translateText(complaint),
        translateText(diagnosedComplaint),
      ]);
    }

    res.status(200).json({
      success: true,
      data: { complaint: translatedComplaint, diagnosedComplaint: translatedDiagnosis, soap },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
