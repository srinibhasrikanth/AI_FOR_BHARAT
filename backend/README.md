# AI for Bharat — Backend

Express + MongoDB (Mongoose) REST API backend for the AI for Bharat healthcare platform.

---

## 📁 Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── controllers/               # Route handler logic (to be added)
│   ├── middleware/
│   │   └── auth.middleware.js     # JWT verification middleware
│   ├── models/
│   │   ├── Doctor.model.js
│   │   ├── Patient.model.js
│   │   ├── Session.model.js
│   │   ├── Transcript.model.js
│   │   ├── Record.model.js
│   │   ├── LabReport.model.js
│   │   ├── Medicine.model.js
│   │   ├── Pharmacist.model.js
│   │   ├── Admin.model.js
│   │   └── Prescription.model.js
│   ├── routes/                    # Express routers (to be added)
│   ├── utils/
│   │   ├── api.utils.js           # ApiResponse, ApiError, asyncHandler
│   │   └── token.utils.js         # JWT token generators
│   ├── app.js                     # Express app setup
│   └── index.js                   # Entry point
├── .env                           # Environment variables (git-ignored)
├── .env.example                   # Template for env vars
├── .gitignore
└── package.json
```

---

## 🗂️ Data Models Overview

| Model        | Key Fields                                                              |
|--------------|-------------------------------------------------------------------------|
| Doctor       | doctorId, name, email, password, specialization, languagesKnown, sessions |
| Patient      | patientId, name, email, gender, bloodGroup, records, qr, emergencyContacts |
| Session      | sessionId, startTimestamp, endTimestamp, patientId, doctorId, status    |
| Transcript   | transcriptId, language, data (Mixed), recordId                          |
| Record       | recordId, patientId, doctorId, vitals, medicines, labReports, totalBill |
| LabReport    | reportId, testName, testType, status, resultData, doctorId, recordId    |
| Medicine     | medicineId, name, dosage, cost, quantity, lastEditedBy (Pharmacist)     |
| Pharmacist   | pharmacistId, name, designation, email, password                        |
| Admin        | adminId, name, email, password                                          |
| Prescription | prescriptionId, patientId, doctorId, recordId, data, medicines          |

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable               | Description                       |
|------------------------|-----------------------------------|
| `PORT`                 | Server port (default: 8080)       |
| `MONGO_URI`            | MongoDB connection string         |
| `DB_NAME`              | Database name                     |
| `ACCESS_TOKEN_SECRET`  | JWT access token signing secret   |
| `REFRESH_TOKEN_SECRET` | JWT refresh token signing secret  |
| `CLIENT_ORIGIN`        | Frontend URL for CORS             |

### Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### Health Check

```
GET http://localhost:8080/health
```

---

## 🔐 Authentication Notes

- Passwords are hashed with **bcryptjs** (salt rounds: 12) before being stored.
- `password` and `refreshToken` fields have `select: false` and won't be returned in queries by default.
- Access tokens expire in **15 minutes**; refresh tokens in **7 days**.
- JWT middleware reads tokens from `Authorization: Bearer <token>` header **or** an `accessToken` cookie.
