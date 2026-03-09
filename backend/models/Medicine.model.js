const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    medicineId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["Tablet","Capsule","Syrup","Injection","Cream/Ointment","Drops","Inhaler","Patch","Suppository","Powder","Solution","Other"],
      default: "Tablet",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: null,
    },
    batchNumber: {
      type: String,
      trim: true,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    dosage: {
      type: String,
      required: [true, "Dosage is required"],
      trim: true,
      // e.g., "500mg", "10mg/5ml"
    },
    unit: {
      type: String,
      default: "units",
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    cost: {
      type: Number,
      required: [true, "Cost is required"],
      min: [0, "Cost cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
    reorderLevel: {
      type: Number,
      default: 20,
      min: [0, "Reorder level cannot be negative"],
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacist",
      default: null,
    },
    lastEdited: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-update lastEdited on every save
medicineSchema.pre("save", function (next) {
  this.lastEdited = new Date();
  next();
});

const Medicine = mongoose.model("Medicine", medicineSchema);

module.exports = Medicine;
