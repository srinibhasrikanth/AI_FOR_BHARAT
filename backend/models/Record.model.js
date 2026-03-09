const mongoose = require('mongoose');

const vitalsSchema = new mongoose.Schema(
  {
    height: { type: Number, default: null },   // cm
    weight: { type: Number, default: null },   // kg
    sugar:  { type: Number, default: null },   // mg/dL
    spO2:   { type: Number, default: null },   // %
    temperature: { type: Number, default: null }, // °F or °C
    pr:     { type: Number, default: null },   // Pulse Rate (bpm)
    bp:     { type: String, default: null },   // e.g. "120/80 mmHg"
    hr:     { type: Number, default: null },   // Heart Rate (bpm)
  },
  { _id: false }
);

const medicineEntrySchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    // time slots: e.g. ["morning_before_breakfast", "night_after_dinner"]
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
  },
  { _id: false }
);

const recordSchema = new mongoose.Schema(
  {
    recordId: {
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
    timestamp: {
      type: Date,
      default: Date.now,
    },
    complaint: {
      type: String,
      trim: true,
      default: null,
    },
    diagnosedComplaint: {
      type: String,
      trim: true,
      default: null,
    },
    vitals: {
      type: vitalsSchema,
      default: () => ({}),
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor ID is required"],
    },
    medicines: {
      type: [medicineEntrySchema],
      default: [],
    },
    labReports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LabReport",
      },
    ],
    totalBill: {
      type: Number,
      default: 0,
      min: 0,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Record = mongoose.model("Record", recordSchema);

module.exports = Record;
