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
// ========================== USER MODEL - UPDATED WITH NEW FIELDS ==========================
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
    // ==================== NEW FIELDS ====================
    secretCode: { 
        type: String, 
        trim: true 
    },
    referredBy: { 
        type: String, 
        trim: true 
    },
    secretCodeEntryLogs: [{
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    plan: { type: String, default: 'free' }
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
// ========================== M-PESA DARAJA INTEGRATION ==========================
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_BASE_URL = 'https://sandbox.safaricom.co.ke';
let isLoggedOut = false;
function logout() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    isLoggedOut = true;
    currentToken = null;
    currentLoggedInEmail = null;
    isNewUser = false;
    hasStartedPlan = false;
    sessionStorage.clear();
    document.getElementById("mainApp").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
    document.getElementById("inactivityWarningModal").style.display = "none";
}
// Get OAuth Token
async function getMpesaAccessToken() {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
}
// STK Push Route
app.post('/api/mpesa/stkpush', authMiddleware, async (req, res) => {
    try {
        const { phone, amount, planType, accountReference } = req.body;
        if (!phone || !amount || !planType) {
            return res.status(400).json({ msg: "Phone, amount and planType are required" });
        }
        const accessToken = await getMpesaAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
        const payload = {
            BusinessShortCode: MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone.replace(/^0/, '254'),
            PartyB: MPESA_SHORTCODE,
            PhoneNumber: phone.replace(/^0/, '254'),
            CallBackURL: CALLBACK_URL,
            AccountReference: accountReference || "BodaGoPlan",
            TransactionDesc: planType
        };
        const response = await axios.post(
            `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        console.log("M-Pesa STK Push Response:", response.data);
        if (response.data.ResponseCode === "0") {
            res.json({
                success: true,
                msg: "STK Push initiated successfully. Check your phone.",
                checkoutRequestID: response.data.CheckoutRequestID
            });
        } else {
            res.status(400).json({ msg: response.data.ResponseDescription || "Failed to initiate payment" });
        }
    } catch (err) {
        console.error("M-Pesa STK Error:", err.response?.data || err.message);
        res.status(500).json({
            msg: "Failed to connect to M-Pesa. Please try again."
        });
    }
});
// M-Pesa Callback Route
app.post('/api/mpesa/callback', async (req, res) => {
    try {
        const callbackData = req.body;
        console.log("M-Pesa Callback Received:", JSON.stringify(callbackData, null, 2));
        if (callbackData.Body?.stkCallback?.ResultCode === 0) {
            const phone = callbackData.Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'PhoneNumber').Value;
            const amount = callbackData.Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'Amount').Value;
            console.log(`✅ Payment successful! Amount: ${amount}, Phone: ${phone}`);
        }
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (err) {
        console.error("Callback error:", err);
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
});
// ========================== EXISTING ROUTES (100% UNCHANGED) ==========================
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log('Register attempt for email:', email);
        if (!email || !password) {
            return res.status(400).json({ msg: 'Email and password are required' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = new User({
            email,
            password: hashedPassword,
            consentGiven: true
        });
        if (email === 'wambuguhkw@gmail.com') {
            user.permanentID = '170320358';
        }
        await user.save();
        console.log('User registered successfully:', email);
        res.status(201).json({ msg: 'Account created successfully! You can now login.' });
    } catch (err) {
        console.error('Register error details:', err.message);
        res.status(500).json({ msg: 'Registration failed. Please try again.' });
    }
});
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, msg: 'Login successful' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ msg: 'Login failed' });
    }
});
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email }).select('-password');
        if (!user) return res.status(404).json({ msg: 'Profile not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ msg: 'Failed to load profile' });
    }
});
// ========================== UPDATED PROFILE SAVE ROUTE ==========================
app.post('/api/profile', authMiddleware, async (req, res) => {
    try {
        const { secretCode, referredBy, ...updateData } = req.body;

        // Secret Code is required when saving changes
        if (!secretCode) {
            return res.status(400).json({ msg: 'Secret Code is required to save profile changes' });
        }

        // Validation: At least 4 numbers and 2 letters
        const numCount = (secretCode.match(/\d/g) || []).length;
        const letterCount = (secretCode.match(/[a-zA-Z]/g) || []).length;
        if (numCount < 4 || letterCount < 2) {
            return res.status(400).json({ msg: 'Secret Code must contain at least 4 numbers and 2 letters in any order' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // First time setting secret code or updating it
        if (!user.secretCode) {
            user.secretCode = secretCode;
        } else if (user.secretCode !== secretCode) {
            return res.status(400).json({ msg: 'Incorrect Secret Code' });
        }

        // Log successful secret code entry with timestamp
        user.secretCodeEntryLogs.push({ timestamp: new Date() });

        // Update other fields
        if (referredBy) user.referredBy = referredBy;
        if (updateData.fullName) user.fullName = updateData.fullName;
        if (updateData.nationalID) user.nationalID = updateData.nationalID;
        if (updateData.address) user.address = updateData.address;
        if (updateData.phone) user.phone = updateData.phone;
        if (updateData.properties) user.properties = updateData.properties;
        if (updateData.bankAccounts) user.bankAccounts = updateData.bankAccounts;
        if (updateData.beneficiaries) user.beneficiaries = updateData.beneficiaries;
        if (typeof updateData.consentGiven !== 'undefined') user.consentGiven = updateData.consentGiven;
        if (updateData.documents) user.documents = updateData.documents;

        user.updatedAt = new Date();
        await user.save();

        res.json({ 
            msg: 'Profile saved successfully', 
            user: {
                ...user.toObject(),
                secretCode: undefined,           // Never send secret code back in full
                secretCodeEntryLogs: user.secretCodeEntryLogs // Send logs for display
            } 
        });
    } catch (err) {
        console.error('Profile save error:', err);
        res.status(500).json({ msg: 'Failed to save profile' });
    }
});
app.post('/api/search-profiles', async (req, res) => {
    const { term } = req.body;
    if (!term || term.trim().length < 2) return res.json([]);
    try {
        const results = await User.find({
            $or: [
                { fullName: { $regex: term, $options: 'i' } },
                { nationalID: { $regex: term, $options: 'i' } },
                { phone: { $regex: term, $options: 'i' } },
                { email: { $regex: term, $options: 'i' } }
            ]
        }).select('-password -documents -secretCode -secretCodeEntryLogs'); // Never expose secret code or logs in search
        res.json(results);
    } catch (err) {
        res.status(500).json([]);
    }
});
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/documents/upload', authMiddleware, upload.array('documents'), async (req, res) => {
  try {
    const documentNames = req.body.documentNames;
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ msg: "No files received" });
    }
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ msg: "User not found" });
    for (let i = 0; i < files.length; i++) {
      user.documents.push({
        name: Array.isArray(documentNames) ? documentNames[i] : documentNames,
        filename: files[i].originalname,
        contentType: files[i].mimetype,
        data: files[i].buffer
      });
    }
    await user.save();
    res.json({ msg: "Documents saved successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});
app.get('/api/documents/:docId/view', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    const doc = user.documents.id(req.params.docId);
    if (!doc) return res.status(404).send("Document not found");
    res.set('Content-Type', doc.contentType);
    res.send(doc.data);
  } catch (err) {
    res.status(500).send("Error");
  }
});
app.get('/api/documents/:docId/download', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    const doc = user.documents.id(req.params.docId);
    if (!doc) return res.status(404).send("Document not found");
    res.set('Content-Type', doc.contentType);
    res.set('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.data);
  } catch (err) {
    res.status(500).send("Error");
  }
});
// ========================== START SERVER ==========================
app.listen(PORT, () => {
    console.log(`\n🚀 TRX InfoSec Backend running on http://localhost:${PORT}`);
    console.log('M-Pesa STK Push route is now active.\n');
});
app.get("/", (req, res) => {
  res.send("Server is running - M-Pesa integration active");
});
