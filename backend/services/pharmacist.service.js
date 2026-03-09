const { v4: uuidv4 } = require('uuid');
const Pharmacist = require('../models/Pharmacist.model');
const Prescription = require('../models/Prescription.model');
const Medicine = require('../models/Medicine.model');
const InventoryTransaction = require('../models/InventoryTransaction.model');

// ─── Helper: log inventory change ─────────────────────────────────────────────
async function logInventory({ medicineId, medicineName, type, quantityChange, quantityBefore, quantityAfter, performedBy, performedByName, prescriptionId, patientId, patientName, notes }) {
  try {
    await InventoryTransaction.create({
      transactionId: 'TXN-' + uuidv4().slice(0, 10).toUpperCase(),
      medicineId, medicineName, type,
      quantityChange, quantityBefore, quantityAfter,
      performedBy: performedBy || null,
      performedByName: performedByName || null,
      performedByRole: 'Pharmacist',
      prescriptionId: prescriptionId || null,
      patientId: patientId || null,
      patientName: patientName || null,
      notes: notes || null,
    });
  } catch (e) {
    console.error('Failed to log inventory transaction:', e.message);
  }
}

// ─── Get Pharmacist by ID ──────────────────────────────────────────────────────
const getPharmacistById = async (pharmacistId) => {
  const pharmacist = await Pharmacist.findById(pharmacistId).select('-password -refreshToken');
  if (!pharmacist) throw Object.assign(new Error('Pharmacist not found'), { statusCode: 404 });
  return pharmacist;
};

// ─── Get Pharmacist Profile ────────────────────────────────────────────────────
const getMyProfile = async (userId) => {
  const pharmacist = await Pharmacist.findById(userId).select('-password -refreshToken');
  if (!pharmacist) throw Object.assign(new Error('Pharmacist not found'), { statusCode: 404 });
  return pharmacist;
};

// ─── Update Pharmacist Profile ─────────────────────────────────────────────────
const updatePharmacistProfile = async (userId, updateData) => {
  const { password, email, pharmacistId, ...allowedUpdates } = updateData;
  if (allowedUpdates.languagesKnown) {
    const existing = await Pharmacist.findById(userId).select('languagesKnown').lean();
    if (existing) {
      const originalLangs = existing.languagesKnown || [];
      allowedUpdates.languagesKnown = [...new Set([...originalLangs, ...allowedUpdates.languagesKnown])];
    }
  }
  const pharmacist = await Pharmacist.findByIdAndUpdate(userId, { $set: allowedUpdates }, { new: true, runValidators: true }).select('-password -refreshToken');
  if (!pharmacist) throw Object.assign(new Error('Pharmacist not found'), { statusCode: 404 });
  return pharmacist;
};

// ─── Get All Prescriptions ─────────────────────────────────────────────────────
const getAllPrescriptions = async () => {
  return Prescription.find()
    .populate('patientId', 'name patientId')
    .populate('doctorId', 'name specialization')
    .populate('dispensedBy', 'name')
    .populate('medicines.medicineId', 'name dosage quantity unit')
    .sort({ createdAt: -1 });
};

// ─── Get Prescription Stats ────────────────────────────────────────────────────
const getPrescriptionStats = async () => {
  const [total, pending, dispensed, cancelled] = await Promise.all([
    Prescription.countDocuments(),
    Prescription.countDocuments({ status: 'pending' }),
    Prescription.countDocuments({ status: 'dispensed' }),
    Prescription.countDocuments({ status: 'cancelled' }),
  ]);
  return { total, pending, dispensed, cancelled };
};

// ─── Dispense Prescription ────────────────────────────────────────────────────
const dispensePrescription = async (prescriptionId, pharmacistId, notes) => {
  const rx = await Prescription.findById(prescriptionId)
    .populate('patientId', 'name patientId')
    .populate('medicines.medicineId', 'name quantity reorderLevel unit');

  if (!rx) throw Object.assign(new Error('Prescription not found'), { statusCode: 404 });
  if (rx.status !== 'pending') throw Object.assign(new Error(`Prescription is already ${rx.status}`), { statusCode: 400 });

  const pharmacist = await Pharmacist.findById(pharmacistId).select('name').lean();

  // Deduct stock for each prescribed medicine
  const stockAlerts = [];
  for (const item of rx.medicines) {
    const med = item.medicineId;
    if (!med) continue;
    const required = calcRequired(item);
    if (med.quantity < required) {
      stockAlerts.push({ name: item.name || med.name, required, available: med.quantity });
    }
  }

  // Deduct regardless (allow partial dispense with stock alerts)
  for (const item of rx.medicines) {
    const med = item.medicineId;
    if (!med) continue;
    const required = calcRequired(item);
    const deduction = Math.min(required, med.quantity);
    if (deduction <= 0) continue;
    const before = med.quantity;
    await Medicine.findByIdAndUpdate(med._id, {
      $inc: { quantity: -deduction },
      lastEditedBy: pharmacistId,
      lastEdited: new Date(),
    });
    await logInventory({
      medicineId: med._id,
      medicineName: item.name || med.name,
      type: 'dispensed',
      quantityChange: -deduction,
      quantityBefore: before,
      quantityAfter: before - deduction,
      performedBy: pharmacistId,
      performedByName: pharmacist?.name || null,
      prescriptionId: rx._id,
      patientId: rx.patientId?._id || rx.patientId,
      patientName: rx.patientId?.name || null,
      notes: notes || null,
    });
  }

  rx.status = stockAlerts.length > 0 ? 'partially_dispensed' : 'dispensed';
  rx.dispensedBy = pharmacistId;
  rx.dispensedAt = new Date();
  rx.dispensingNotes = notes || null;
  rx.stockAlerts = stockAlerts;
  await rx.save();

  return rx;
};

// ─── Flag / Cancel Prescription ───────────────────────────────────────────────
const flagPrescription = async (prescriptionId, pharmacistId, reason) => {
  const rx = await Prescription.findById(prescriptionId);
  if (!rx) throw Object.assign(new Error('Prescription not found'), { statusCode: 404 });
  if (rx.status !== 'pending') throw Object.assign(new Error(`Cannot flag a prescription with status: ${rx.status}`), { statusCode: 400 });

  rx.status = 'cancelled';
  rx.dispensedBy = pharmacistId;
  rx.dispensedAt = new Date();
  rx.flaggedReason = reason;
  await rx.save();
  return rx;
};

// ─── Helper: calc required quantity ───────────────────────────────────────────
function calcRequired(item) {
  const days = item.durationDays || 1;
  const daily = (item.time || []).filter(t => t !== 'sos');
  if (daily.length === 0 && (item.time || []).includes('sos')) return 1;
  return days * Math.max(daily.length, 1);
}

// ─── Get All Medicines ─────────────────────────────────────────────────────────
const getAllMedicines = async () => {
  return Medicine.find().populate('lastEditedBy', 'name').sort({ name: 1 });
};

// ─── Get Low-Stock Medicines ───────────────────────────────────────────────────
const getLowStockMedicines = async () => {
  // Medicines where quantity <= reorderLevel
  const meds = await Medicine.find().populate('lastEditedBy', 'name').lean();
  return meds.filter(m => m.quantity <= m.reorderLevel).sort((a, b) => a.quantity - b.quantity);
};

// ─── Add Medicine ─────────────────────────────────────────────────────────────
const addMedicine = async (pharmacistId, data) => {
  const { name, category, manufacturer, batchNumber, expiryDate, dosage, unit, description, cost, quantity, reorderLevel } = data;
  if (!name || !dosage || cost == null || quantity == null) {
    throw Object.assign(new Error('name, dosage, cost, and quantity are required'), { statusCode: 400 });
  }
  const medicineId = 'MED-' + uuidv4().slice(0, 8).toUpperCase();
  const medicine = await Medicine.create({
    medicineId,
    name: name.trim(),
    category: category || 'Tablet',
    manufacturer: manufacturer || null,
    batchNumber: batchNumber || null,
    expiryDate: expiryDate || null,
    dosage: dosage.trim(),
    unit: unit || 'units',
    description: description || null,
    cost: Number(cost),
    quantity: Number(quantity),
    reorderLevel: Number(reorderLevel) || 20,
    lastEditedBy: pharmacistId,
  });
  await logInventory({
    medicineId: medicine._id,
    medicineName: medicine.name,
    type: 'initial',
    quantityChange: Number(quantity),
    quantityBefore: 0,
    quantityAfter: Number(quantity),
    performedBy: pharmacistId,
    performedByName: null,
    notes: 'Initial stock entry',
  });
  return medicine;
};

// ─── Update Medicine ─────────────────────────────────────────────────────────
const updateMedicine = async (medicineId, pharmacistId, data) => {
  const { cost, quantity, reorderLevel, ...rest } = data;
  const existing = await Medicine.findById(medicineId);
  if (!existing) throw Object.assign(new Error('Medicine not found'), { statusCode: 404 });

  const updates = {
    ...rest,
    lastEditedBy: pharmacistId,
    lastEdited: new Date(),
  };
  if (cost != null) updates.cost = Number(cost);
  if (reorderLevel != null) updates.reorderLevel = Number(reorderLevel);

  let quantityAdjustment = null;
  if (quantity != null && Number(quantity) !== existing.quantity) {
    const newQty = Number(quantity);
    quantityAdjustment = { before: existing.quantity, after: newQty, change: newQty - existing.quantity };
    updates.quantity = newQty;
  }

  const medicine = await Medicine.findByIdAndUpdate(medicineId, { $set: updates }, { new: true, runValidators: true }).populate('lastEditedBy', 'name');
  if (!medicine) throw Object.assign(new Error('Medicine not found'), { statusCode: 404 });

  if (quantityAdjustment) {
    await logInventory({
      medicineId: medicine._id,
      medicineName: medicine.name,
      type: 'adjustment',
      quantityChange: quantityAdjustment.change,
      quantityBefore: quantityAdjustment.before,
      quantityAfter: quantityAdjustment.after,
      performedBy: pharmacistId,
      notes: 'Quantity adjusted via edit',
    });
  }
  return medicine;
};

// ─── Delete Medicine ──────────────────────────────────────────────────────────
const deleteMedicine = async (medicineId, pharmacistId) => {
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) throw Object.assign(new Error('Medicine not found'), { statusCode: 404 });

  await logInventory({
    medicineId: medicine._id,
    medicineName: medicine.name,
    type: 'deleted',
    quantityChange: -medicine.quantity,
    quantityBefore: medicine.quantity,
    quantityAfter: 0,
    performedBy: pharmacistId,
    notes: 'Medicine removed from inventory',
  });
  await Medicine.findByIdAndDelete(medicineId);
  return { message: 'Medicine deleted successfully' };
};

// ─── Restock Medicine ─────────────────────────────────────────────────────────
const restockMedicine = async (medicineId, pharmacistId, quantity, notes) => {
  if (!quantity || Number(quantity) <= 0) throw Object.assign(new Error('Quantity must be positive'), { statusCode: 400 });
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) throw Object.assign(new Error('Medicine not found'), { statusCode: 404 });

  const before = medicine.quantity;
  const after = before + Number(quantity);
  medicine.quantity = after;
  medicine.lastEditedBy = pharmacistId;
  medicine.lastEdited = new Date();
  await medicine.save();

  const pharmacist = await Pharmacist.findById(pharmacistId).select('name').lean();
  await logInventory({
    medicineId: medicine._id,
    medicineName: medicine.name,
    type: 'restock',
    quantityChange: Number(quantity),
    quantityBefore: before,
    quantityAfter: after,
    performedBy: pharmacistId,
    performedByName: pharmacist?.name || null,
    notes: notes || null,
  });
  return await Medicine.findById(medicineId).populate('lastEditedBy', 'name');
};

// ─── Get Inventory Stats ──────────────────────────────────────────────────────
const getInventoryStats = async () => {
  const medicines = await Medicine.find().lean();
  const totalStockValue = medicines.reduce((sum, m) => sum + (m.cost * m.quantity), 0);
  const outOfStockCount = medicines.filter(m => m.quantity === 0).length;
  const lowStockCount = medicines.filter(m => m.quantity > 0 && m.quantity <= m.reorderLevel).length;

  // Category breakdown
  const categoryMap = {};
  for (const m of medicines) {
    const cat = m.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { category: cat, count: 0, totalQty: 0, totalValue: 0 };
    categoryMap[cat].count += 1;
    categoryMap[cat].totalQty += m.quantity;
    categoryMap[cat].totalValue += m.cost * m.quantity;
  }
  return {
    totalMedicines: medicines.length,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    outOfStockCount,
    lowStockCount,
    categoryBreakdown: Object.values(categoryMap),
  };
};

// ─── Get Inventory Transaction Logs ──────────────────────────────────────────
const getInventoryLogs = async ({ page = 1, limit = 20, type } = {}) => {
  const filter = type && type !== 'all' ? { type } : {};
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    InventoryTransaction.countDocuments(filter),
  ]);
  return { transactions, total, page, totalPages: Math.ceil(total / limit) };
};

module.exports = {
  getPharmacistById,
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
};

