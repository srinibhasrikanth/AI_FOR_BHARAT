const mongoose = require('mongoose');

const labReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor ID (ordering doctor) is required"],
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Record",
      required: [true, "Record ID is required"],
    },
    testName: {
      type: String,
      required: [true, "Test name is required"],
      trim: true,
      // e.g., "CBC", "LFT", "MRI Brain", "Urine R/M"
    },
    testType: {
      type: String,
      enum: ["blood", "imaging", "urine", "pathology", "microbiology", "biochemistry", "other"],
      required: [true, "Test type is required"],
    },
    orderedTimestamp: {
      type: Date,
      default: Date.now,
    },
    resultTimestamp: {
      type: Date,
      default: null,
    },
    // resultData can be structured JSON or a file URL (PDF/image)
    resultData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
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

const LabReport = mongoose.model("LabReport", labReportSchema);

module.exports = LabReport;
