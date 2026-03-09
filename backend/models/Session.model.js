const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    startTimestamp: {
      type: Date,
      required: [true, "Start timestamp is required"],
    },
    endTimestamp: {
      type: Date,
      default: null,
    },
    transcriptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transcript",
      default: null,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Patient ID is required"],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor ID is required"],
    },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled", "no_show"],
      default: "scheduled",
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    draftData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
