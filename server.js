// ====================== TRX InfoSec Backend - FINAL FIXED VERSION ======================
require('dotenv').config();
const nodemailer = require('nodemailer');
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
    plan: { type: String, default: 'free' }, // Added for plan tracking
    lastLogin: { type: Date }   // ← NEW: Last Login tracking
});
const User = mongoose.model('User', userSchema);

// ========================== AUTH MIDDLEWARE ==========================
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'Unauthorized' });
}

const token = authHeader.split(' ')[1];

// 🚨 CRITICAL FIX
if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ msg: 'Unauthorized' });
}

try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
} catch (err) {
    return res.status(401).json({ msg: 'Unauthorized' });
}
};

// ========================== M-PESA DARAJA INTEGRATION ==========================
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_BASE_URL = 'https://sandbox.safaricom.co.ke'; // Change to https://api.safaricom.co.ke for production

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
            // Optionally save pending payment in DB here later
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

        // You can process successful payments here (update user plan, etc.)
        if (callbackData.Body?.stkCallback?.ResultCode === 0) {
            const phone = callbackData.Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'PhoneNumber').Value;
            const amount = callbackData.Body.stkCallback.CallbackMetadata.Item.find(i => i.Name === 'Amount').Value;
            
            console.log(`✅ Payment successful! Amount: ${amount}, Phone: ${phone}`);
            // TODO: Update user plan in database here
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

        // Update last login time
        user.lastLogin = new Date();
        await user.save();

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

app.post('/api/profile', authMiddleware, async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.email;
        const user = await User.findOneAndUpdate(
            { email: req.user.email },
            { $set: updateData },
            { new: true }
        ).select('-password');
        res.json({ msg: 'Profile saved successfully', user });
    } catch (err) {
        console.error('Profile save error:', err);
        res.status(500).json({ msg: 'Failed to save profile' });
    }
});

app.post('/api/search-profiles', authMiddleware, async (req, res) => {
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
        }).select('-password -documents');
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
    res.json({ msg: "Documents saved to MongoDB" });
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

// ========================== PROFILE VERIFICATION (OTP) ROUTES - ADDED TO FIX "Create/Edit Profile" BUTTON ==========================

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP temporarily (in production use Redis)
const otpStore = new Map();

// Send verification code for profile editing
app.post('/api/send-profile-verification', authMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || email !== req.user.email) {
            return res.status(400).json({ msg: "Invalid email" });
        }

        const otp = generateOTP();
        otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000 }); // 10 minutes

        // Configure nodemailer (using Gmail - change to your preferred service)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,        // Your Gmail
                pass: process.env.EMAIL_APP_PASSWORD // App password (not normal password)
            }
        });

        await transporter.sendMail({
            from: `"GrowthBase" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "GrowthBase - Profile Edit Verification Code",
            html: `
                <h2>Profile Edit Verification</h2>
                <p>Your 6-digit verification code is: <strong>${otp}</strong></p>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            `
        });

        res.json({ msg: "Verification code sent to your email" });
    } catch (err) {
        console.error("Send OTP error:", err);
        res.status(500).json({ msg: "Failed to send verification code" });
    }
});

// Verify OTP
app.post('/api/verify-profile-otp', authMiddleware, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ msg: "Email and OTP are required" });
        }

        const stored = otpStore.get(email);
        if (!stored || stored.expires < Date.now()) {
            return res.status(400).json({ msg: "Code expired. Please request a new one." });
        }

        if (stored.otp !== otp) {
            return res.status(400).json({ msg: "Invalid verification code" });
        }

        otpStore.delete(email); // Clear OTP after successful use
        res.json({ msg: "Verification successful" });
    } catch (err) {
        console.error("Verify OTP error:", err);
        res.status(500).json({ msg: "Verification failed" });
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
