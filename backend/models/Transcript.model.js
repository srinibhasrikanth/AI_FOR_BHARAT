const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema(
  {
    transcriptId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    language: {
      type: String,
      required: [true, "Language is required"],
      trim: true,
    },
    // 'data' stores the full transcript content.
    // Can be a raw text string, or a structured array of utterances:
    // [{ speaker: "doctor" | "patient", text: "...", timestamp: Date }]
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Transcript data is required"],
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Record",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Transcript = mongoose.model("Transcript", transcriptSchema);

module.exports = Transcript;
