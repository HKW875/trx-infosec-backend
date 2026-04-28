// ====================== TRX InfoSec Backend - FULLY CORRECTED VERSION ======================
const express = require('express');
const app = express();
const multer = require("multer");
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const JWT_SECRET = 'trx-infosec-secure-jwt-key-2026-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || "https://trxinfosec.hkw875.workers.dev";
const MONGO_URI = process.env.MONGO_URI;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || "https://trx-infosec-backend-vvrq.onrender.com/api/mpesa/callback";

// ========================== MIDDLEWARE ==========================
app.use('/uploads', express.static('uploads'))
const corsOptions = {
  origin: ['https://growthbase.net', 'https://trxinfosec.hkw875.workers.dev'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};

// This makes the 'uploads' folder public so the browser can see the images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
    mobileNumber: { type: String, trim: true },
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
    secretCode: { type: String },
    secretCodeLogs: [
        {
            date: { type: Date, default: Date.now }
        }
    ],
    referredBy: { type: String, trim: true },
    businessType: { type: String, trim: true },
    totalCapitalRequired: { type: String, trim: true },
    purposeOfCapital: { type: String, trim: true },
    occupation: { type: String, trim: true },
    location: {
        latitude: Number,
        longitude: Number,
        timestamp: { type: Date, default: Date.now }
    },
    // ===== MY GOAL: stored as array on user profile =====
    goals: [{
        product: { type: String, trim: true },
        category: { type: String, trim: true },
        budget: { type: String, trim: true },
        desiredDate: { type: String, trim: true },
        notifyMe: { type: String, trim: true, default: 'yes' },
        createdAt: { type: Date, default: Date.now }
    }],
    points: { type: Number, default: 0 },

    loginLogs: [
      { date: { type: Date, default: Date.now } }
    ],

    formSubmissions: [
      { date: { type: Date, default: Date.now } }
    ],

    referralPhone: { type: String, trim: true }
});

const User = mongoose.model('User', userSchema);

// ========================== ADVERT MODEL ==========================
let Advert;
try {
    Advert = mongoose.model('Advert');
} catch (e) {
    const advertSchema = new mongoose.Schema({
        category: { type: String, trim: true },
        title: { type: String, trim: true },
        price: { type: String, trim: true },
        description: { type: String, trim: true },
        locationName: { type: String, trim: true },
        phone: { type: String, trim: true },
        condition: { type: String, trim: true },
        images: [{ type: String }],
        geo: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        },
        createdAt: { type: Date, default: Date.now }
    });
    Advert = mongoose.model('Advert', advertSchema);
}

// ========================== CATEGORY MODEL ==========================
let Category;
try {
    Category = mongoose.model('Category');
} catch (e) {
    const categorySchema = new mongoose.Schema({
        name: String,
        image: String // base64 string OR file path
    });
    Category = mongoose.model('Category', categorySchema);
}

// ========================== GOAL MODEL (standalone, for unauthenticated goals) ==========================
let Goal;
try {
    Goal = mongoose.model('Goal');
} catch (e) {
    const goalSchema = new mongoose.Schema({
        product: { type: String, trim: true },
        category: { type: String, trim: true },
        budget: { type: String, trim: true },
        desiredDate: { type: String, trim: true },
        notifyMe: { type: String, trim: true, default: 'yes' },
        userEmail: { type: String, trim: true, default: null }, // null = anonymous
        createdAt: { type: Date, default: Date.now }
    });
    Goal = mongoose.model('Goal', goalSchema);
}

// ========================== MULTER SETUP ==========================
// Ensure the upload directory exists
const uploadDir = './uploads/ads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/ads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// ========================== ADS ROUTES ==========================

// POST: Create a new Ad
app.post('/api/ads/create', upload.array('images', 5), async (req, res) => {
    try {
        console.log("BODY:", req.body);
        console.log("FILES:", req.files);

        const imagePaths = (req.files || []).map(file =>
            '/uploads/ads/' + file.filename
        );

        const newAd = new Advert({
            category: req.body.category,
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            locationName: req.body.locationName,
            phone: req.body.phone,
            condition: req.body.condition?.toLowerCase(),
            images: imagePaths,
            geo: {
                lat: req.body.lat ? parseFloat(req.body.lat) : null,
                lng: req.body.lng ? parseFloat(req.body.lng) : null
            }
        });

        await newAd.save();
        return res.status(201).json({
            success: true,
            message: 'Ad created successfully!'
        });
    } catch (error) {
        console.error("CREATE AD ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// GET: Fetch ads (optionally filtered by category and/or search term)
app.get('/api/ads', async (req, res) => {
    try {
        const { category, search } = req.query;

        let query = {};

        if (category) {
            query.category = category;
        }

        // Full-text style search across title, description, locationName, category
        if (search) {
            const regex = new RegExp(search, 'i');
            const searchConditions = [
                { title: regex },
                { description: regex },
                { locationName: regex },
                { category: regex }
            ];
            if (category) {
                // Combine category filter with search
                query = {
                    category: category,
                    $or: searchConditions
                };
            } else {
                query = { $or: searchConditions };
            }
        }

        const ads = await Advert.find(query).sort({ createdAt: -1 });
        res.json({ data: ads });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
});

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

// ========================== MY GOAL ROUTE ==========================
// POST /api/goals — saves a user goal (authenticated saves to user profile, anonymous saves to Goal collection)
app.post('/api/goals', async (req, res) => {
    try {
        const { product, category, budget, desiredDate, notifyMe } = req.body;

        if (!product) {
            return res.status(400).json({ msg: 'Product or service name is required.' });
        }

        const goalData = { product, category, budget, desiredDate, notifyMe: notifyMe || 'yes' };

        // Check if request is authenticated
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
                const user = await User.findOne({ email: decoded.email });
                if (user) {
                    // Save goal to user's profile
                    user.goals.push(goalData);
                    await user.save();
                    console.log(`✅ Goal saved to user profile: ${decoded.email}`);
                    return res.status(201).json({ msg: 'Goal saved to your profile successfully.' });
                }
            } catch (tokenErr) {
                // Token invalid — fall through to anonymous save
            }
        }

        // Anonymous: save to standalone Goal collection
        const newGoal = new Goal({ ...goalData, userEmail: null });
        await newGoal.save();
        console.log(`✅ Anonymous goal saved: ${product}`);
        return res.status(201).json({ msg: 'Goal saved successfully.' });

    } catch (err) {
        console.error('Goal save error:', err);
        res.status(500).json({ msg: 'Failed to save goal. Please try again.' });
    }
});

// GET /api/goals — retrieve goals for authenticated user
app.get('/api/goals', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email }).select('goals');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json({ goals: user.goals || [] });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to retrieve goals.' });
    }
});

// ========================== SECRET CODE VERIFY ==========================
app.post('/api/verify-secret', authMiddleware, async (req, res) => {
    try {
        const { secretCode } = req.body;
        if (!secretCode) return res.status(400).json({ msg: 'Secret code is required' });
        const user = await User.findOne({ email: req.user.email });
        if (!user || !user.secretCode) return res.status(400).json({ msg: 'No secret code set' });
        const isMatch = await bcrypt.compare(secretCode, user.secretCode);
        if (!isMatch) return res.status(400).json({ msg: 'Incorrect secret code.' });
        user.secretCodeLogs.push({ date: new Date() });
        await user.save();
        res.json({ msg: 'Secret code verified successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

// ========================== FORGOT PASSWORD ROUTES ==========================
app.post('/api/forgot-password/verify', async (req, res) => {
    const { email, phone, secretCode } = req.body;
    try {
        const user = await User.findOne({ email, phone });
        if (!user) return res.status(400).json({ msg: "Details do not match our records." });
        const isSecretMatch = await bcrypt.compare(secretCode, user.secretCode || '');
        if (!isSecretMatch) return res.status(400).json({ msg: "Details do not match our records." });
        res.json({ msg: "Verified" });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});

app.post('/api/forgot-password/reset', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "User not found" });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        res.json({ msg: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});

// ========================== GEOLOCATION ==========================
app.post('/api/save-location', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude, timestamp } = req.body;
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: "User not found" });
        user.location = {
            latitude,
            longitude,
            timestamp: timestamp || new Date()
        };
        await user.save();
        res.json({ msg: "Geolocation saved successfully" });
    } catch (err) {
        res.status(500).json({ msg: "Server error" });
    }
});

// ========================== OCCUPATION STATS ==========================
app.get('/api/occupations-stats', authMiddleware, async (req, res) => {
    try {
        const users = await User.find({ occupation: { $exists: true } }).select('occupation');
        const occupationCount = {};
        users.forEach(user => {
            const occ = user.occupation && user.occupation.trim() !== ""
                ? user.occupation.trim()
                : "Not Provided";
            occupationCount[occ] = (occupationCount[occ] || 0) + 1;
        });
        const totalUsers = users.length || 1;
        const labels = Object.keys(occupationCount);
        const percentages = labels.map(label =>
            Math.round((occupationCount[label] / totalUsers) * 100 * 10) / 10
        );
        res.json({
            labels: labels.length > 0 ? labels : ["No data yet"],
            percentages: percentages.length > 0 ? percentages : [100],
            counts: Object.values(occupationCount)
        });
    } catch (err) {
        res.status(500).json({ msg: "Failed to generate statistics" });
    }
});

// ========================== AUTH ROUTES ==========================
app.post('/api/register', async (req, res) => {
    const { email, password, mobileNumber, occupation, confirmPassword, secretCode } = req.body;
    try {
        console.log('Register attempt for email:', email);
        if (!email || !password || !mobileNumber || !occupation || !confirmPassword || !secretCode) {
            return res.status(400).json({ msg: 'All fields are required' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ msg: 'Passwords do not match' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const hashedSecret = await bcrypt.hash(secretCode, salt);
        const user = new User({
            email,
            password: hashedPassword,
            mobileNumber,
            occupation,
            secretCode: hashedSecret,
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

        const token = jwt.sign(
            { id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // ===== LOGIN POINT LOGIC =====
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!user.loginLogs) user.loginLogs = [];
        if (!user.points) user.points = 0;

        const alreadyLoggedToday = user.loginLogs.some(log => {
            const logDate = new Date(log.date);
            logDate.setHours(0, 0, 0, 0);
            return logDate.getTime() === today.getTime();
        });

        if (!alreadyLoggedToday) {
            user.points += 1;
            user.loginLogs.push({ date: new Date() });
            await user.save();
        }

        res.json({
            token,
            msg: 'Login successful',
            points: user.points
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ msg: 'Login failed' });
    }
});

app.post('/api/referral-submit', authMiddleware, async (req, res) => {
    try {
        const { referredBy, referralPhone } = req.body;

        const user = await User.findOne({ email: req.user.email });

        if (!user) return res.status(404).json({ msg: "User not found" });

        // Save submission
        user.referredBy = referredBy || '';
        user.referralPhone = referralPhone || '';

        user.points += 2; // form submission reward
        user.formSubmissions.push({ date: new Date() });

        // Referral match logic
        if (referredBy && referralPhone) {
            const refUser = await User.findOne({
                fullName: { $regex: `^${referredBy}$`, $options: 'i' },
                mobileNumber: referralPhone
            });

            if (refUser) {
                refUser.points += 5;
                await refUser.save();
            }
        }

        await user.save();

        res.json({ msg: "Saved successfully", points: user.points });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Error saving referral" });
    }
});

app.get('/api/points', authMiddleware, async (req, res) => {
    const user = await User.findOne({ email: req.user.email });
    res.json({ points: user.points || 0 });
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
        const { secretCodeInput, referredBy, businessType, totalCapitalRequired, purposeOfCapital, ...updateData } = req.body;
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.secretCode) {
            if (!secretCodeInput) {
                return res.status(400).json({ msg: 'Secret code required to save changes.' });
            }
            const isMatch = await bcrypt.compare(secretCodeInput, user.secretCode);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Incorrect secret code.' });
            }
            user.secretCodeLogs.push({ date: new Date() });
        }
        if (!user.secretCode && secretCodeInput) {
            const regex = /^(?=(?:.*\d){4,})(?=(?:.*[A-Za-z]){2,}).+$/;
            if (!regex.test(secretCodeInput)) {
                return res.status(400).json({ msg: 'Secret code must contain at least 4 numbers and 2 letters.' });
            }
            const salt = await bcrypt.genSalt(10);
            user.secretCode = await bcrypt.hash(secretCodeInput, salt);
        }
        delete updateData.email;
        Object.assign(user, updateData);
        if (referredBy !== undefined) user.referredBy = referredBy;
        if (businessType !== undefined) user.businessType = businessType;
        if (totalCapitalRequired !== undefined) user.totalCapitalRequired = totalCapitalRequired;
        if (purposeOfCapital !== undefined) user.purposeOfCapital = purposeOfCapital;
        await user.save();
        res.json({ msg: 'Profile saved successfully', user });
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
        }).select('-password -documents -secretCode -secretCodeLogs');
        res.json(results);
    } catch (err) {
        res.status(500).json([]);
    }
});

// ========================== DOCUMENT ROUTES ==========================
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

// ========================== M-PESA ROUTES ==========================
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_BASE_URL = 'https://sandbox.safaricom.co.ke';

async function getMpesaAccessToken() {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
}

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
        res.status(500).json({ msg: "Failed to connect to M-Pesa. Please try again." });
    }
});

app.post('/api/mpesa/callback', async (req, res) => {
    try {
        const callbackData = req.body;
        console.log("M-Pesa Callback Received:", JSON.stringify(callbackData, null, 2));
        if (callbackData.Body?.stkCallback?.ResultCode === 0) {
            console.log(`✅ Payment successful!`);
        }
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (err) {
        console.error("Callback error:", err);
        res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
});

// ========================== ROOT ROUTE ==========================
app.get("/", (req, res) => {
    res.send("Server is running - M-Pesa integration active");
});

// ========================== START SERVER ==========================
app.listen(PORT, () => {
    console.log(`\n🚀 TRX InfoSec Backend running on http://localhost:${PORT}`);
    console.log('M-Pesa STK Push route is now active.\n');
});
