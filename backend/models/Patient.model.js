const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    relation: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      required: [true, "Gender is required"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: [true, "Blood group is required"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    dob: {
      type: String,
      required: [true, "Date of birth is required"],
      trim: true,
    },
    records: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Record",
      },
    ],
    qr: {
      type: String, // QR code string / data URL / file path
      default: null,
    },
    languagesKnown: {
      type: [String],
      default: [],
    },
    emergencyContacts: {
      type: [emergencyContactSchema],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'hi', 'te'],
      default: 'en',
    },
    refreshToken: {
      type: String,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
patientSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
patientSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
