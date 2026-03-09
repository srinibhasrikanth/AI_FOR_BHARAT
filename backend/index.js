require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { scheduleMedicineReminders } = require('./cron/medicineReminder.cron');

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  await connectDB();

  // Start scheduled jobs
  scheduleMedicineReminders();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port number ${PORT}`);
    console.log(`📄 Working Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();
