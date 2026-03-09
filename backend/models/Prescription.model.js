const mongoose = require('mongoose');

const prescribedMedicineSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    dosage: {
      type: String,
      trim: true,
    },
    durationDays: {
      type: Number,
      min: 1,
    },
    time: {
      type: [String],
      enum: [
        "morning_before_breakfast",
        "morning_after_breakfast",
        "afternoon_before_lunch",
        "afternoon_after_lunch",
        "evening",
        "night_before_dinner",
        "night_after_dinner",
        "sos",
      ],
      default: [],
    },
    instructions: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Patient ID is required"],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,   // null when prescription is uploaded directly by a patient
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Record",
      default: null,
    },
    // 'data' is a free-text or structured summary (diagnosis notes, instructions, etc.)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    medicines: {
      type: [prescribedMedicineSchema],
      default: [],
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    // ─── Dispensing fields ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "dispensed", "partially_dispensed", "cancelled"],
      default: "pending",
    },
    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacist",
      default: null,
    },
    dispensedAt: {
      type: Date,
      default: null,
    },
    dispensingNotes: {
      type: String,
      default: null,
    },
    flaggedReason: {
      type: String,
      default: null,
    },
    stockAlerts: {
      type: [
        {
          name: String,
          required: Number,
          available: Number,
        }
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Prescription = mongoose.model("Prescription", prescriptionSchema);

module.exports = Prescription;
