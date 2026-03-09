const express = require('express');
const Patient = require('../models/Patient.model');

const router = express.Router();

/**
 * @swagger
 * /public/patient/{patientId}:
 *   get:
 *     tags: [Public]
 *     summary: Get patient emergency info (public)
 *     description: Returns limited patient data for the Emergency QR page. No authentication required.
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId or custom patientId (e.g. PAT-XXXXXXXX)
 *     responses:
 *       200:
 *         description: Patient emergency info
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
 *                     name:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *                     dob:
 *                       type: string
 *                     gender:
 *                       type: string
 *                     bloodGroup:
 *                       type: string
 *                     languagesKnown:
 *                       type: array
 *                       items:
 *                         type: string
 *                     emergencyContacts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EmergencyContact'
 *       404:
 *         description: Patient not found
 */
router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const fields = 'name phoneNumber dob gender bloodGroup languagesKnown allergies conditions patientId emergencyContacts';

    let patient = null;

    // Try Mongo ObjectId first
    if (/^[a-f\d]{24}$/i.test(patientId)) {
      patient = await Patient.findById(patientId).select(fields);
    }

    // Fallback: try the custom patientId string (e.g. PAT-XXXXXXXX)
    if (!patient) {
      patient = await Patient.findOne({ patientId }).select(fields);
    }

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
