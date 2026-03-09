const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true, default: '' },
    unitPrice: { type: Number, required: true, min: 0 },
    requiredQty: { type: Number, required: true, min: 1 },
    isPrescribed: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    // Razorpay
    razorpayOrderId: { type: String, default: null, trim: true },
    razorpayPaymentId: { type: String, default: null, trim: true },
    razorpaySignature: { type: String, default: null, trim: true },

    // Status lifecycle: pending_payment → paid → dispensed
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'dispensed', 'cancelled'],
      default: 'pending_payment',
    },

    // Array of QR tokens — one entry per successful payment / re-generation.
    // Structure: [{ token, createdAt, isActive }]
    // isActive=true means the pharmacist hasn't scanned/dispensed this token yet.
    qrTokens: {
      type: [
        {
          token:     { type: String, required: true },
          createdAt: { type: Date,   default: Date.now },
          isActive:  { type: Boolean, default: true },
        },
      ],
      default: [],
    },

    // Timestamps for key events
    paidAt: { type: Date, default: null },
    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacist',
      default: null,
    },
    dispensedAt: { type: Date, default: null },
    dispensingNotes: { type: String, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual: exposes the latest active token string as `qrToken`
// so the frontend and existing consumers need no changes.
orderSchema.virtual('qrToken').get(function () {
  if (!this.qrTokens || this.qrTokens.length === 0) return null;
  const active = [...this.qrTokens].reverse().find((t) => t.isActive);
  return active ? active.token : null;
});

module.exports = mongoose.model('Order', orderSchema);
