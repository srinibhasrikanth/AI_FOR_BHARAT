require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  const Admin = require('../models/Admin.model');

  const secret = process.env.USER_SECRET_KEY;
  // Pass the HMAC hash as "password" — the model pre-save hook will bcrypt it
  const hmacHash = crypto.createHmac('sha256', secret).update('Admin@123').digest('hex');

  const existing = await Admin.findOne({ email: 'admin@gmail.com' });
  if (existing) {
    existing.password = hmacHash;
    await existing.save();
    console.log('Admin password updated. ID:', existing.adminId);
  } else {
    const admin = new Admin({
      adminId: 'ADM-' + uuidv4().slice(0, 8).toUpperCase(),
      name: 'Admin',
      email: 'admin@gmail.com',
      password: hmacHash,
    });
    await admin.save();
    console.log('Admin created. ID:', admin.adminId);
  }
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
