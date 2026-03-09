const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    // Type of transaction
    type: {
      type: String,
      enum: ['initial', 'restock', 'dispensed', 'adjustment', 'deleted'],
      required: true,
    },
    quantityChange: {
      type: Number,
      required: true, // positive = added, negative = removed
    },
    quantityBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    // Who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'performedByRole',
      default: null,
    },
    performedByName: {
      type: String,
      default: null,
    },
    performedByRole: {
      type: String,
      enum: ['Pharmacist', 'Doctor', 'Admin'],
      default: 'Pharmacist',
    },
    // Optional references
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
    },
    patientName: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);

module.exports = InventoryTransaction;
