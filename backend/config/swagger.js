const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'MediFlow API',
    version: '1.0.0',
    description:
      'Complete REST API documentation for the MediFlow Healthcare platform. Manages patients, doctors, pharmacists, admin, consultations, prescriptions, lab reports, and voice-AI pipeline.',
    contact: { name: 'MediFlow Team' },
    license: { name: 'MIT' },
  },
  servers: [
    {
      url: 'https://d2fpk2puwv8uqu.cloudfront.net/api/v1',
      description: 'Production server (CloudFront)',
    },
    {
      url: 'http://localhost:8080/api/v1',
      description: 'Local development server',
      variables: {
        port: { default: '8080' },
      },
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health check' },
    { name: 'Auth', description: 'Authentication & registration' },
    { name: 'Patient', description: 'Patient profile, records, prescriptions & lab reports' },
    { name: 'Doctor', description: 'Doctor profile, sessions, consultations & voice pipeline' },
    { name: 'Pharmacist', description: 'Pharmacist profile, prescriptions & inventory' },
    { name: 'Admin', description: 'Admin CRUD for all users & sessions' },
    { name: 'Public', description: 'Publicly accessible patient info (emergency QR)' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the JWT access token obtained from /auth/login',
      },
    },
    schemas: {
      // ── Reusable response wrapper ──
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
        },
      },

      // ── Admin ──
      Admin: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          adminId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Doctor ──
      Doctor: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          doctorId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phoneNumber: { type: 'string' },
          dob: { type: 'string', description: 'DD-MM-YYYY' },
          specialization: { type: 'string' },
          languagesKnown: { type: 'array', items: { type: 'string' } },
          sessions: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Patient ──
      EmergencyContact: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phoneNumber: { type: 'string' },
          address: { type: 'string' },
          relation: { type: 'string' },
        },
      },
      Patient: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          patientId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          gender: { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
          phoneNumber: { type: 'string' },
          dob: { type: 'string', description: 'DD-MM-YYYY' },
          languagesKnown: { type: 'array', items: { type: 'string' } },
          emergencyContacts: { type: 'array', items: { $ref: '#/components/schemas/EmergencyContact' } },
          preferredLanguage: { type: 'string', enum: ['en', 'hi', 'te'] },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Pharmacist ──
      Pharmacist: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          pharmacistId: { type: 'string' },
          name: { type: 'string' },
          designation: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phoneNumber: { type: 'string' },
          languagesKnown: { type: 'array', items: { type: 'string' } },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Vitals ──
      Vitals: {
        type: 'object',
        properties: {
          height: { type: 'number', description: 'cm' },
          weight: { type: 'number', description: 'kg' },
          sugar: { type: 'number', description: 'mg/dL' },
          spO2: { type: 'number', description: '%' },
          temperature: { type: 'number', description: '°F' },
          pr: { type: 'number', description: 'Pulse rate bpm' },
          bp: { type: 'string', description: 'e.g. 120/80 mmHg' },
          hr: { type: 'number', description: 'Heart rate bpm' },
        },
      },

      // ── Medicine ──
      Medicine: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          medicineId: { type: 'string' },
          name: { type: 'string' },
          dosage: { type: 'string' },
          cost: { type: 'number' },
          quantity: { type: 'number' },
          lastEditedBy: { type: 'string' },
          lastEdited: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── PrescribedMedicine (embedded) ──
      PrescribedMedicine: {
        type: 'object',
        properties: {
          medicineId: { type: 'string' },
          name: { type: 'string' },
          dosage: { type: 'string' },
          durationDays: { type: 'number' },
          time: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'morning_before_breakfast', 'morning_after_breakfast',
                'afternoon_before_lunch', 'afternoon_after_lunch',
                'evening', 'night_before_dinner', 'night_after_dinner', 'sos',
              ],
            },
          },
          instructions: { type: 'string' },
        },
      },

      // ── Prescription ──
      Prescription: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          prescriptionId: { type: 'string' },
          patientId: { type: 'string' },
          doctorId: { type: 'string' },
          recordId: { type: 'string' },
          data: { type: 'object', description: 'Free-form consultation data (SOAP notes, ICD-10, etc.)' },
          medicines: { type: 'array', items: { $ref: '#/components/schemas/PrescribedMedicine' } },
          issuedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Record ──
      MedicineEntry: {
        type: 'object',
        properties: {
          medicineId: { type: 'string' },
          durationDays: { type: 'number' },
          time: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'morning_before_breakfast', 'morning_after_breakfast',
                'afternoon_before_lunch', 'afternoon_after_lunch',
                'evening', 'night_before_dinner', 'night_after_dinner', 'sos',
              ],
            },
          },
        },
      },
      Record: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          recordId: { type: 'string' },
          patientId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          complaint: { type: 'string' },
          diagnosedComplaint: { type: 'string' },
          vitals: { $ref: '#/components/schemas/Vitals' },
          doctorId: { type: 'string' },
          medicines: { type: 'array', items: { $ref: '#/components/schemas/MedicineEntry' } },
          labReports: { type: 'array', items: { type: 'string' } },
          totalBill: { type: 'number' },
          isResolved: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── LabReport ──
      LabReport: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          reportId: { type: 'string' },
          doctorId: { type: 'string' },
          recordId: { type: 'string' },
          testName: { type: 'string' },
          testType: { type: 'string', enum: ['blood', 'imaging', 'urine', 'pathology', 'microbiology', 'biochemistry', 'other'] },
          orderedTimestamp: { type: 'string', format: 'date-time' },
          resultTimestamp: { type: 'string', format: 'date-time' },
          resultData: { type: 'object' },
          status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
          notes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Session ──
      Session: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          sessionId: { type: 'string' },
          startTimestamp: { type: 'string', format: 'date-time' },
          endTimestamp: { type: 'string', format: 'date-time' },
          transcriptId: { type: 'string' },
          patientId: { type: 'string' },
          doctorId: { type: 'string' },
          status: { type: 'string', enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'no_show'] },
          notes: { type: 'string' },
          draftData: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Transcript ──
      Transcript: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          transcriptId: { type: 'string' },
          language: { type: 'string' },
          data: { type: 'object', description: 'Raw transcript text or array of { speaker, text, timestamp }' },
          recordId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Login ──
      LoginRequest: {
        type: 'object',
        required: ['email', 'password', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['patient', 'doctor', 'pharmacist', 'admin'] },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              user: { type: 'object' },
            },
          },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // JSDoc annotations in route files
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
