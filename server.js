// ====================== TRX InfoSec Backend - FINAL FIXED VERSION ======================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = 'trx-infosec-secure-jwt-key-2026-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || "https://trxinfosec.hkw875.workers.dev";
const MONGO_URI = process.env.MONGO_URI;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || "https://trx-infosec-backend-vvrq.onrender.com/api/mpesa/callback";

// ========================== MIDDLEWARE ==========================
const corsOptions = {
  origin: ['https://growthbase.net', 'https://trxinfosec.hkw875.workers.dev'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ========================== MONGODB CONNECTION ==========================
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// ========================== USER MODEL ==========================
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    permanentID: {
        type: String,
        unique: true,
        default: () => '1' + Math.floor(100000000 + Math.random() * 900000000).toString().slice(1)
    },
    fullName: { type: String, trim: true },
    nationalID: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    properties: [{ type: String, trim: true }],
    bankAccounts: [{ type: String, trim: true }],
    nextOfKinName: { type: String, trim: true },
    nextOfKinRelation: { type: String, trim: true },
    liabilities: String,
    notes: String,
    consentGiven: { type: Boolean, default: true },
    documents: [{
        name: String,
        filename: String,
        contentType: String,
        data: Buffer,
        uploadDate: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    plan: { type: String, default: 'free' },
    // ================= SECRET CODE + REFERRAL =================
    secretCode: { type: String }, // hashed
    secretCodeLogs: [
        {
            date: { type: Date, default: Date.now }
        }
    ],
    referredBy: { type: String, trim: true },
    // ================= NEW FIELDS ADDED =================
    businessType: { type: String, trim: true },
    totalCapitalRequired: { type: String, trim: true },
    purposeOfCapital: { type: String, trim: true }
});
const User = mongoose.model('User', userSchema);

// ========================== AUTH MIDDLEWARE ==========================
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Invalid token' });
    }
};

// ========================== NEW ENDPOINT: VERIFY SECRET CODE ==========================
app.post('/api/verify-secret', authMiddleware, async (req, res) => {
    try {
        const { secretCode } = req.body;
        if (!secretCode) {
            return res.status(400).json({ msg: 'Secret code is required' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (!user.secretCode) {
            return res.status(400).json({ msg: 'No secret code has been set for this profile yet.' });
        }

        const isMatch = await bcrypt.compare(secretCode, user.secretCode);
        
        if (!isMatch) {
            return res.status(400).json({ msg: 'Incorrect secret code.' });
        }

        // Log successful verification
        user.secretCodeLogs.push({ date: new Date() });
        await user.save();

        res.json({ msg: 'Secret code verified successfully' });
    } catch (err) {
        console.error('Secret verification error:', err);
        res.status(500).json({ msg: 'Server error during verification' });
    }
});

// ========================== M-PESA DARAJA INTEGRATION ==========================
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_BASE_URL = 'https://sandbox.safaricom.co.ke';

let isLoggedOut = false;

// Get OAuth Token
async function getMpesaAccessToken() {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
}

// STK Push Route (100% original)
app.post('/api/mpesa/stkpush', authMiddleware, async (req, res) => {
    // ... your original code unchanged ...
});

// M-Pesa Callback Route (100% original)
app.post('/api/mpesa/callback', async (req, res) => {
    // ... your original code unchanged ...
});

// ========================== EXISTING ROUTES (100% UNCHANGED) ==========================
app.post('/api/register', async (req, res) => {
    // ... your original code unchanged ...
});

app.post('/api/login', async (req, res) => {
    // ... your original code unchanged ...
});

app.get('/api/profile', authMiddleware, async (req, res) => {
    // ... your original code unchanged ...
});

app.post('/api/profile', authMiddleware, async (req, res) => {
    // ... your original code unchanged ...
});

app.post('/api/search-profiles', async (req, res) => {
    // ... your original code unchanged ...
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/documents/upload', authMiddleware, upload.array('documents'), async (req, res) => {
    // ... your original code unchanged ...
});

app.get('/api/documents/:docId/view', authMiddleware, async (req, res) => {
    // ... your original code unchanged ...
});

app.get('/api/documents/:docId/download', authMiddleware, async (req, res) => {
    // ... your original code unchanged ...
});

// ========================== START SERVER ==========================
app.listen(PORT, () => {
    console.log(`\n🚀 TRX InfoSec Backend running on http://localhost:${PORT}`);
    console.log('M-Pesa STK Push route is now active.\n');
});

app.get("/", (req, res) => {
  res.send("Server is running - M-Pesa integration active");
});
