// ====================== TRX InfoSec Backend - FINAL FIXED VERSION ======================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = 'trx-infosec-secure-jwt-key-2026-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || "https://trxinfosec.hkw875.workers.dev";
const MONGO_URI = process.env.MONGO_URI;
//mongoose.connect(process.env.MONGO_URI || 'your-mongodb-uri');

// Configure CORS
// CORS configuration for your custom domain
const corsOptions = {
  origin: ['https://growthbase.net', 'https://trxinfosec.hkw875.workers.dev'],    // ← Change to your actual frontend domain
  // If you have multiple domains (e.g. staging + production):
  // origin: ['https://yourapp.com', 'https://staging.yourapp.com'],
 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,          // Important for login (cookies/sessions)
  maxAge: 86400               // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

// ========================== MIDDLEWARE ==========================
//app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));

// ========================== MONGODB CONNECTION ==========================


mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// ========================== USER MODEL (CLEAN - NO PRE HOOK) ==========================
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
    updatedAt: { type: Date, default: Date.now }
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

// ========================== ROUTES ==========================

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log('Register attempt for email:', email);   // ← Debug log

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
        console.error('Full error:', err);
        res.status(500).json({ msg: 'Registration failed. Please try again.' });
    }
});

// Other routes (login, profile, search) remain the same as before
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
        }).select('-password -documents');
        res.json(results);
    } catch (err) {
        res.status(500).json([]);
    }
});

// Routes (add to your router)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Upload multiple documents
app.post('/api/documents/upload', authMiddleware, upload.array('documents'), async (req, res) => {
  try {
    const documentNames = req.body.documentNames; // array from form
    const files = req.files;
    console.log("FILES:", files);
    console.log("NAMES:", documentNames);

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

// View document
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

// Download document
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
    console.log('Try registering now - check terminal for detailed logs.\n');
});

app.get("/", (req, res) => {
  res.send("Server is running");
});
