const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8080',
  'https://d1v63994hsf7r3.cloudfront.net',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // allow any local-network origin (192.168.x.x or 10.x.x.x on any port)
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Handle preflight OPTIONS requests explicitly — required when behind CloudFront
// CloudFront must forward the Origin header; this ensures Express always responds
// to browser preflight checks before CloudFront can cache/drop the response.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Parse JSON only for non-multipart requests
app.use(express.json({ 
  limit: '50mb',
  type: 'application/json'
}));

// Parse URL-encoded only for non-multipart requests
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  type: 'application/x-www-form-urlencoded'
}));

app.use(cookieParser());
app.use(morgan('dev'));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// ─── Swagger UI ────────────────────────────────────────────────────────────────
// Apply CORS explicitly on Swagger routes so the UI works when opened from
// the production frontend origin (CloudFront) and can hit /api-docs.json.
app.use('/api-docs', cors(corsOptions), swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MediFlow API Docs',
  swaggerOptions: {
    // Pre-select the production server in the Swagger UI dropdown
    url: '/api-docs.json',
    persistAuthorization: true,
  },
}));
app.get('/api-docs.json', cors(corsOptions), (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── API Routes ────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const patientRoutes = require('./routes/patient.routes');
const doctorRoutes = require('./routes/doctor.routes');
const pharmacistRoutes = require('./routes/pharmacist.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patient', patientRoutes);
app.use('/api/v1/doctor', doctorRoutes);
app.use('/api/v1/pharmacist', pharmacistRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/public', publicRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[GlobalError] ${statusCode} — ${err.message}`);
  if (err.body) console.error('[GlobalError] body:', JSON.stringify(err.body, null, 2));
  if (statusCode >= 500) console.error(err.stack);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
