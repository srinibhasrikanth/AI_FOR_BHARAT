const express = require('express');
const { verifyJWT, checkRole } = require('../middleware/auth.middleware');
const {
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  getAllPharmacists,
  getPharmacistById,
  updatePharmacist,
  deletePharmacist,
  getAllSessions,
} = require('../services/admin.service');

const router = express.Router();

// All routes require authentication and admin role
router.use(verifyJWT);
router.use(checkRole('admin'));

// ─── Patient Management ────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/patients:
 *   get:
 *     tags: [Admin]
 *     summary: Get all patients
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Patients list
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
 *                     $ref: '#/components/schemas/Patient'
 */
router.get('/patients', async (req, res, next) => {
  try {
    const patients = await getAllPatients();
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
 * /admin/patients/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get patient by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patient data
 *       404:
 *         description: Not found
 */
router.get('/patients/:id', async (req, res, next) => {
  try {
    const patient = await getPatientById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Patient retrieved successfully',
      data: patient,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/patients/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update patient
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Patient updated
 */
router.put('/patients/:id', async (req, res, next) => {
  try {
    const patient = await updatePatient(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      data: patient,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/patients/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete patient
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patient deleted
 *       404:
 *         description: Not found
 */
router.delete('/patients/:id', async (req, res, next) => {
  try {
    const result = await deletePatient(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Doctor Management ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/doctors:
 *   get:
 *     tags: [Admin]
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
router.get('/doctors', async (req, res, next) => {
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
 * /admin/doctors/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get doctor by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doctor data
 *       404:
 *         description: Not found
 */
router.get('/doctors/:id', async (req, res, next) => {
  try {
    const doctor = await getDoctorById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Doctor retrieved successfully',
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/doctors/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update doctor
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Doctor updated
 */
router.put('/doctors/:id', async (req, res, next) => {
  try {
    const doctor = await updateDoctor(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctor,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/doctors/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete doctor
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doctor deleted
 */
router.delete('/doctors/:id', async (req, res, next) => {
  try {
    const result = await deleteDoctor(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Pharmacist Management ─────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pharmacists:
 *   get:
 *     tags: [Admin]
 *     summary: Get all pharmacists
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Pharmacists list
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
 *                     $ref: '#/components/schemas/Pharmacist'
 */
router.get('/pharmacists', async (req, res, next) => {
  try {
    const pharmacists = await getAllPharmacists();
    res.status(200).json({
      success: true,
      message: 'Pharmacists retrieved successfully',
      data: pharmacists,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/pharmacists/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get pharmacist by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pharmacist data
 */
router.get('/pharmacists/:id', async (req, res, next) => {
  try {
    const pharmacist = await getPharmacistById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Pharmacist retrieved successfully',
      data: pharmacist,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/pharmacists/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update pharmacist
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Pharmacist updated
 */
router.put('/pharmacists/:id', async (req, res, next) => {
  try {
    const pharmacist = await updatePharmacist(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Pharmacist updated successfully',
      data: pharmacist,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/pharmacists/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete pharmacist
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pharmacist deleted
 */
router.delete('/pharmacists/:id', async (req, res, next) => {
  try {
    const result = await deletePharmacist(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Session Management ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/sessions:
 *   get:
 *     tags: [Admin]
 *     summary: Get all sessions
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
router.get('/sessions', async (req, res, next) => {
  try {
    const sessions = await getAllSessions();
    res.status(200).json({
      success: true,
      message: 'Sessions retrieved successfully',
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Ad-hoc Medicine Reminder Trigger ─────────────────────────────────────────
/**
 * @swagger
 * /admin/cron/medicine-reminder:
 *   post:
 *     tags: [Admin]
 *     summary: Manually trigger the medicine reminder job for a specific date
 *     description: >
 *       Use this endpoint to backfill reminder emails when the scheduled cron job
 *       failed to run for a given date. The normal scheduled cron is NOT affected.
 *       Requires admin authentication.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-03"
 *                 description: The date (YYYY-MM-DD) to send reminders for
 *               slotGroup:
 *                 type: string
 *                 enum: [morning, afternoon, evening, night]
 *                 description: Specific slot to remind. Omit to run all slots.
 *     responses:
 *       200:
 *         description: Job triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing or invalid date / slotGroup
 *       500:
 *         description: Job failed
 */
router.post('/cron/medicine-reminder', async (req, res) => {
  const { date, slotGroup = null } = req.body;

  // Validate date
  if (!date) {
    return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD).' });
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({ success: false, message: `Invalid date: "${date}". Use YYYY-MM-DD format.` });
  }

  // Validate slotGroup if provided
  const VALID_SLOTS = ['morning', 'afternoon', 'evening', 'night'];
  if (slotGroup !== null && slotGroup !== undefined && !VALID_SLOTS.includes(slotGroup)) {
    return res.status(400).json({
      success: false,
      message: `Invalid slotGroup "${slotGroup}". Allowed values: ${VALID_SLOTS.join(', ')} — or omit for all slots.`,
    });
  }

  try {
    const { runMedicineReminderJob } = require('../cron/medicineReminder.cron');
    // Run without awaiting so the HTTP response returns immediately;
    // the job logs its own progress to the server console.
    runMedicineReminderJob(slotGroup || null, date)
      .then(() => console.log(`[AdHoc] Medicine reminder job completed for ${date} [${slotGroup || 'all-slots'}]`))
      .catch((err) => console.error(`[AdHoc] Medicine reminder job failed for ${date}:`, err.message));

    return res.status(200).json({
      success: true,
      message: `Medicine reminder job triggered for date: ${date}, slot: ${slotGroup || 'all slots'}. Emails will be sent in the background — check server logs for progress.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
