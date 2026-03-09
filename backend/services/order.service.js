const Razorpay = require('razorpay');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Order    = require('../models/Order.model');
const Medicine = require('../models/Medicine.model');
const Prescription = require('../models/Prescription.model');
const InventoryTransaction = require('../models/InventoryTransaction.model');
const Pharmacist = require('../models/Pharmacist.model');

// ─── Razorpay instance (test mode keys from env) ──────────────────────────────
const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID     || 'rzp_test_placeholder',
  key_secret: RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// ─── Helper: log inventory change ─────────────────────────────────────────────
async function logInventory({ medicineId, medicineName, type, quantityChange, quantityBefore, quantityAfter, performedBy, performedByName, orderId, patientId, patientName, notes }) {
  try {
    await InventoryTransaction.create({
      transactionId: 'TXN-' + uuidv4().slice(0, 10).toUpperCase(),
      medicineId, medicineName, type,
      quantityChange, quantityBefore, quantityAfter,
      performedBy: performedBy || null,
      performedByName: performedByName || null,
      performedByRole: 'Pharmacist',
      patientId: patientId || null,
      patientName: patientName || null,
      notes: notes ? `[Order ${orderId}] ${notes}` : `[Order ${orderId}]`,
    });
  } catch (e) {
    console.error('Failed to log inventory transaction:', e.message);
  }
}

// ─── Create Razorpay order (patient initiates checkout) ───────────────────────
const createPharmacyOrder = async (patientId, { prescriptionId, items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { statusCode: 400 });
  }

  // Guard: fail fast if Razorpay keys are not configured
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('XXXX') ||
      !RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.includes('XXXX')) {
    throw Object.assign(
      new Error('Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.'),
      { statusCode: 503 }
    );
  }

  // Validate & price each item from DB
  const pricedItems = [];
  let total = 0;

  for (const item of items) {
    const med = await Medicine.findById(item.medicineId).lean();
    if (!med) throw Object.assign(new Error(`Medicine not found: ${item.medicineId}`), { statusCode: 404 });
    if (med.quantity < item.requiredQty) {
      throw Object.assign(new Error(`Insufficient stock for ${med.name} (available: ${med.quantity})`), { statusCode: 400 });
    }
    const lineTotal = med.cost * item.requiredQty;
    total += lineTotal;
    pricedItems.push({
      medicineId:  med._id,
      name:        med.name,
      dosage:      med.dosage || '',
      unitPrice:   med.cost,
      requiredQty: item.requiredQty,
      isPrescribed: !!item.isPrescribed,
    });
  }

  // Create Razorpay order
  let rpOrder;
  try {
    rpOrder = await razorpay.orders.create({
      amount:   Math.round(total * 100), // paise
      currency: 'INR',
      receipt:  'ORD-' + uuidv4().slice(0, 8).toUpperCase(),
      notes:    { patientId: String(patientId) },
    });
  } catch (rzpErr) {
    // Razorpay auth failures (bad keys) return statusCode 401 — re-throw as 502
    // so it is not confused with our own JWT 401 by the global error handler.
    const msg = rzpErr?.error?.description || rzpErr?.message || 'Razorpay order creation failed';
    const status = rzpErr?.statusCode === 401 ? 502 : (rzpErr?.statusCode || 502);
    throw Object.assign(new Error(`Payment gateway error: ${msg}`), { statusCode: status });
  }

  // Save to DB
  const orderId = 'ORD-' + uuidv4().slice(0, 10).toUpperCase();
  const order = await Order.create({
    orderId,
    patientId,
    prescriptionId: prescriptionId || null,
    items: pricedItems,
    total,
    razorpayOrderId: rpOrder.id,
    status: 'pending_payment',
  });

  return {
    order,
    razorpayOrderId: rpOrder.id,
    amount:          rpOrder.amount,
    currency:        rpOrder.currency,
    keyId:           process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  };
};

// ─── Verify Razorpay payment & mark order paid + generate QR token ────────────
const verifyAndPayOrder = async (patientId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const order = await Order.findOne({ razorpayOrderId, patientId });
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (order.status !== 'pending_payment') {
    throw Object.assign(new Error(`Order is already ${order.status}`), { statusCode: 400 });
  }

  // Verify HMAC signature
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    throw Object.assign(new Error('Payment verification failed: invalid signature'), { statusCode: 400 });
  }

  // Generate QR token (signed JWT, expires in 24 h)
  const qrToken = jwt.sign(
    { orderId: order._id.toString(), patientId: patientId.toString(), type: 'pharmacy_qr' },
    process.env.JWT_SECRET || 'mediflow_secret',
    { expiresIn: '24h' }
  );

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.status = 'paid';
  order.paidAt = new Date();
  // Push a new active token entry — preserves history of prior tokens
  order.qrTokens.push({ token: qrToken, createdAt: new Date(), isActive: true });
  await order.save();

  return order.populate('patientId', 'name patientId');
};

// ─── Get patient's orders ──────────────────────────────────────────────────────
const getPatientOrders = async (patientId) => {
  return Order.find({ patientId })
    .sort({ createdAt: -1 })
    .populate('patientId', 'name patientId')
    .populate('prescriptionId', 'prescriptionId');
};

// ─── Pharmacist: validate QR token & return order details ─────────────────────
const validateQrToken = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'mediflow_secret');
  } catch (e) {
    throw Object.assign(new Error('QR token is invalid or expired'), { statusCode: 400 });
  }

  if (decoded.type !== 'pharmacy_qr') {
    throw Object.assign(new Error('Invalid QR type'), { statusCode: 400 });
  }

  const order = await Order.findById(decoded.orderId)
    .populate('patientId', 'name patientId phoneNumber')
    .populate('prescriptionId', 'prescriptionId');

  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  // Token must match an active entry (prevents replay of old/dispensed tokens)
  const tokenEntry = order.qrTokens.find((t) => t.token === token && t.isActive);
  if (!tokenEntry) {
    throw Object.assign(new Error('QR token has already been used or invalidated'), { statusCode: 400 });
  }

  if (order.status !== 'paid') {
    if (order.status === 'dispensed') throw Object.assign(new Error('This order has already been dispensed'), { statusCode: 400 });
    throw Object.assign(new Error(`Order status is "${order.status}" — cannot dispense`), { statusCode: 400 });
  }

  return order;
};

// ─── Pharmacist: dispense order (deduct stock & close transaction) ─────────────
const dispenseOrder = async (orderId, pharmacistId, notes) => {
  const order = await Order.findById(orderId)
    .populate('patientId', 'name patientId');

  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (order.status !== 'paid') {
    throw Object.assign(new Error(`Order is already ${order.status}`), { statusCode: 400 });
  }

  const pharmacist = await Pharmacist.findById(pharmacistId).select('name').lean();

  // Deduct medicine stock
  for (const item of order.items) {
    const med = await Medicine.findById(item.medicineId);
    if (!med) continue;
    const deduction = Math.min(item.requiredQty, med.quantity);
    if (deduction <= 0) continue;
    const before = med.quantity;
    await Medicine.findByIdAndUpdate(item.medicineId, {
      $inc: { quantity: -deduction },
      lastEditedBy: pharmacistId,
      lastEdited: new Date(),
    });
    await logInventory({
      medicineId: item.medicineId,
      medicineName: item.name,
      type: 'dispensed',
      quantityChange: -deduction,
      quantityBefore: before,
      quantityAfter: before - deduction,
      performedBy: pharmacistId,
      performedByName: pharmacist?.name || null,
      orderId: order.orderId,
      patientId: order.patientId?._id || order.patientId,
      patientName: order.patientId?.name || null,
      notes: notes || null,
    });
  }

  order.status = 'dispensed';
  order.dispensedBy = pharmacistId;
  order.dispensedAt = new Date();
  order.dispensingNotes = notes || null;
  // Mark all tokens as inactive (keeps history, prevents re-use)
  order.qrTokens.forEach((t) => { t.isActive = false; });
  await order.save();

  return order;
};

module.exports = {
  createPharmacyOrder,
  verifyAndPayOrder,
  getPatientOrders,
  validateQrToken,
  dispenseOrder,
};
