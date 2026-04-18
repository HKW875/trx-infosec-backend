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
const MONGO_URI = process.env.MONGO_URI;

// ========================== MIDDLEWARE ==========================
const corsOptions = { /* your original corsOptions */ };
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ========================== MONGODB CONNECTION ==========================
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// ========================== USER MODEL (phone & secretCode already exist) ==========================
const userSchema = new mongoose.Schema({ /* your original schema - no changes */ });
const User = mongoose.model('User', userSchema);

// ========================== AUTH MIDDLEWARE (unchanged) ==========================
const authMiddleware = (req, res, next) => { /* your original authMiddleware */ };

// ========================== UPDATED REGISTER ==========================
app.post('/api/register', async (req, res) => {
    const { email, phone, password, secretCode } = req.body;
    try {
        if (!email || !phone || !password || !secretCode) {
            return res.status(400).json({ msg: 'All fields (Email, Mobile, Password, Secret Code) are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const hashedSecret = await bcrypt.hash(secretCode, salt);

        const user = new User({
            email,
            phone,
            password: hashedPassword,
            secretCode: hashedSecret,
            consentGiven: true
        });

        await user.save();
        res.status(201).json({ msg: 'Account created successfully! You can now login.' });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ msg: 'Registration failed. Please try again.' });
    }
});

// ========================== NEW RESET PASSWORD ENDPOINT ==========================
app.post('/api/reset-password', async (req, res) => {
    const { email, phone, secretCode, newPassword } = req.body;
    try {
        const user = await User.findOne({ email, phone });
        if (!user) return res.status(400).json({ msg: 'No account found with this email and mobile number' });

        const isSecretMatch = await bcrypt.compare(secretCode, user.secretCode);
        if (!isSecretMatch) return res.status(400).json({ msg: 'Incorrect Secret Code' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error during password reset' });
    }
});

// ========================== ALL YOUR OTHER ORIGINAL ROUTES REMAIN 100% UNCHANGED ==========================
app.post('/api/login', async (req, res) => { /* your original login */ });
app.get('/api/profile', authMiddleware, async (req, res) => { /* your original */ });
app.post('/api/profile', authMiddleware, async (req, res) => { /* your original */ });
// ... all mpesa, documents, verify-secret, etc. remain exactly as you provided

app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
});
