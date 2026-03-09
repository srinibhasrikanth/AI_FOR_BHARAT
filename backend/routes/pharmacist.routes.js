const express = require('express');
const { verifyJWT, checkRole } = require('../middleware/auth.middleware');
const {
  getMyProfile,
  updatePharmacistProfile,
  getAllPrescriptions,
  getPrescriptionStats,
  dispensePrescription,
  flagPrescription,
  getAllMedicines,
  getLowStockMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  restockMedicine,
  getInventoryStats,
  getInventoryLogs,
} = require('../services/pharmacist.service');
const { validateQrToken, dispenseOrder } = require('../services/order.service');

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

/**
 * @swagger
 * /pharmacist/profile:
 *   get:
 *     tags: [Pharmacist]
 *     summary: Get pharmacist profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Pharmacist profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Pharmacist'
 */
router.get('/profile', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const pharmacist = await getMyProfile(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Pharmacist profile retrieved successfully',
      data: pharmacist,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /pharmacist/profile:
 *   put:
 *     tags: [Pharmacist]
 *     summary: Update pharmacist profile
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
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const pharmacist = await updatePharmacistProfile(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Pharmacist profile updated successfully',
      data: pharmacist,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /pharmacist/prescriptions:
 *   get:
 *     tags: [Pharmacist]
 *     summary: Get all prescriptions for dispensing
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Prescriptions list
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
 */
router.get('/prescriptions', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const prescriptions = await getAllPrescriptions();
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
 * /pharmacist/medicines:
 *   get:
 *     tags: [Pharmacist]
 *     summary: Get all medicines (inventory)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Medicines list
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
 *                     $ref: '#/components/schemas/Medicine'
 */
router.get('/medicines', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const medicines = await getAllMedicines();
    res.status(200).json({
      success: true,
      message: 'Medicines retrieved successfully',
      data: medicines,
    });
  } catch (err) {
    next(err);
  }
});

// GET /pharmacist/medicines/low-stock - medicines at or below reorder level
router.get('/medicines/low-stock', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const medicines = await getLowStockMedicines();
    res.status(200).json({ success: true, data: medicines });
  } catch (err) {
    next(err);
  }
});

// POST /pharmacist/medicines - add a new medicine
router.post('/medicines', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const medicine = await addMedicine(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Medicine added successfully', data: medicine });
  } catch (err) {
    next(err);
  }
});

// PUT /pharmacist/medicines/:id - update a medicine
router.put('/medicines/:id', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const medicine = await updateMedicine(req.params.id, req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Medicine updated successfully', data: medicine });
  } catch (err) {
    next(err);
  }
});

// DELETE /pharmacist/medicines/:id - remove a medicine
router.delete('/medicines/:id', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const result = await deleteMedicine(req.params.id, req.user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /pharmacist/medicines/:id/restock - restock a medicine
router.post('/medicines/:id/restock', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const { quantity, notes } = req.body;
    const medicine = await restockMedicine(req.params.id, req.user.id, quantity, notes);
    res.status(200).json({ success: true, message: 'Medicine restocked successfully', data: medicine });
  } catch (err) {
    next(err);
  }
});

// GET /pharmacist/inventory/stats - aggregate inventory stats
router.get('/inventory/stats', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const stats = await getInventoryStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /pharmacist/inventory/logs - paginated transaction log
router.get('/inventory/logs', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const result = await getInventoryLogs({ page: Number(page), limit: Number(limit), type });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /pharmacist/prescriptions/stats - prescription counts by status
router.get('/prescriptions/stats', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const stats = await getPrescriptionStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// POST /pharmacist/prescriptions/:id/dispense - mark prescription as dispensed
router.post('/prescriptions/:id/dispense', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const { notes } = req.body;
    const prescription = await dispensePrescription(req.params.id, req.user.id, notes);
    res.status(200).json({ success: true, message: 'Prescription dispensed successfully', data: prescription });
  } catch (err) {
    next(err);
  }
});

// POST /pharmacist/prescriptions/:id/flag - flag / cancel a prescription
router.post('/prescriptions/:id/flag', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason is required when flagging a prescription' });
    const prescription = await flagPrescription(req.params.id, req.user.id, reason);
    res.status(200).json({ success: true, message: 'Prescription flagged successfully', data: prescription });
  } catch (err) {
    next(err);
  }
});

// ─── QR Order routes ──────────────────────────────────────────────────────────

// POST /pharmacist/orders/scan - validate a QR token and return order details
router.post('/orders/scan', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'QR token is required' });
    const order = await validateQrToken(token);
    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /pharmacist/orders/:id/dispense - dispense a paid order
router.post('/orders/:id/dispense', checkRole('pharmacist'), async (req, res, next) => {
  try {
    const { notes } = req.body;
    const order = await dispenseOrder(req.params.id, req.user.id, notes);
    res.status(200).json({ success: true, message: 'Order dispensed successfully', data: order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
