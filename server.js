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
const webpush = require('web-push');

const PORT = process.env.PORT || 10000;
const JWT_SECRET = 'trx-infosec-secure-jwt-key-2026-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || "https://trxinfosec.hkw875.workers.dev";
const MONGO_URI = process.env.MONGO_URI;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || "https://trx-infosec-backend-vvrq.onrender.com/api/mpesa/callback";

// ========================== WEB PUSH / VAPID SETUP ==========================
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BJviSWpIouFw8IuQX_BdMBmuV69ddCnvPhgVJ_9q9ldR4cjsE1JRtEAYcDn4BUNHjfwDuZ2mvUWp-BVzhOao-x4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'uYy2kzfptROTOK-zyDOtwe87OptFQR3WvczRn62Em7o';
webpush.setVapidDetails(
    'mailto:info@growthbase.net',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// In server.js, ensure the file path is accessible
app.use('/profile-photos', express.static(path.join(__dirname, 'profile-photos')));

// ========================== MIDDLEWARE ==========================
app.use('/uploads', express.static('uploads'))
const corsOptions = {
  origin: [
    'https://growthbase.net',
    'https://www.growthbase.net',
    'https://trxinfosec.hkw875.workers.dev',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
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
    lastLoginTime: { type: Number },
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

    referralPhone: { type: String, trim: true },

    // ===== PROFILE PHOTO (base64 or CDN URL) =====
    profilePhoto: { type: String, default: null },

    // ===== WEB PUSH SUBSCRIPTIONS =====
    pushSubscriptions: [{
        endpoint:   { type: String },
        keys: {
            p256dh: { type: String },
            auth:   { type: String }
        },
        createdAt: { type: Date, default: Date.now }
    }]
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
        views: { type: Number, default: 0 },
        geo: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        },
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        postedByEmail: { type: String, default: null },
        postedByName:  { type: String, default: null },
        postedByPhoto: { type: String, default: null },
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
        userEmail: { type: String, trim: true, default: null },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        createdAt: { type: Date, default: Date.now }
    });
    Goal = mongoose.model('Goal', goalSchema);
}

// ========================== GOAL NOTIFICATION MODEL ==========================
let GoalNotification;
try {
    GoalNotification = mongoose.model('GoalNotification');
} catch (e) {
    const goalNotificationSchema = new mongoose.Schema({
        userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        userEmail:   { type: String, required: true },
        goalId:      { type: mongoose.Schema.Types.ObjectId },
        adId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Advert' },
        type:        { type: String, enum: ['match', 'proximity'], required: true },
        message:     { type: String, required: true },
        adTitle:     { type: String },
        adPrice:     { type: String },
        adPhone:     { type: String },
        adLocation:  { type: String },
        adCategory:  { type: String },
        distance:    { type: Number },
        read:        { type: Boolean, default: false },
        createdAt:   { type: Date, default: Date.now }
    });
    GoalNotification = mongoose.model('GoalNotification', goalNotificationSchema);
}

// ========================== SELLER NOTIFICATION MODEL ==========================
// Notifies ad-posters when a new Goal in their category is submitted nearby (within 10km)
let SellerNotification;
try {
    SellerNotification = mongoose.model('SellerNotification');
} catch (e) {
    const sellerNotificationSchema = new mongoose.Schema({
        sellerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        sellerEmail:  { type: String, required: true },
        adId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Advert' },
        goalId:       { type: mongoose.Schema.Types.ObjectId },
        message:      { type: String, required: true },
        goalProduct:  { type: String },
        goalBudget:   { type: String },
        goalCategory: { type: String },
        buyerLocation:{ type: String },
        distance:     { type: Number },
        read:         { type: Boolean, default: false },
        createdAt:    { type: Date, default: Date.now }
    });
    SellerNotification = mongoose.model('SellerNotification', sellerNotificationSchema);
}

// ========================== CHAT MESSAGE MODEL ==========================
let ChatMessage;
try {
    ChatMessage = mongoose.model('ChatMessage');
} catch (e) {
    const chatMessageSchema = new mongoose.Schema({
        roomId:      { type: String, required: true, index: true }, // e.g. "adId_userId1_userId2"
        adId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Advert' },
        adTitle:     { type: String },
        senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        senderEmail: { type: String, required: true },
        senderName:  { type: String },
        receiverId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        receiverEmail:{ type: String },
        message:     { type: String, required: true },
        read:        { type: Boolean, default: false },
        createdAt:   { type: Date, default: Date.now }
    });
    ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
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

        // Enrich each ad with live poster name + photo (fast: uses stored fields first)
        const enriched = await Promise.all(ads.map(async (ad) => {
            const obj = ad.toObject();
            if (!obj.postedByName && obj.postedBy) {
                try {
                    const poster = await User.findById(obj.postedBy).select('fullName profilePhoto');
                    if (poster) {
                        obj.postedByName  = poster.fullName  || null;
                        obj.postedByPhoto = poster.profilePhoto || null;
                    }
                } catch (e) { /* skip silently */ }
            }
            return obj;
        }));

        res.json({ data: enriched });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
});



// POST: Record a view for a listing
app.post('/api/ads/:id/view', async (req, res) => {
    try {
        await Advert.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to record view' });
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

// POST: Save profile photo — uploads to GitHub repo AND saves URL to MongoDB
app.post('/api/profile/photo', authMiddleware, async (req, res) => {
    try {
        const { photoData } = req.body;
        if (!photoData) return res.status(400).json({ msg: 'No photo data' });

        let photoUrl = photoData; // fallback: store base64 in MongoDB if GitHub upload fails

        // ===== UPLOAD TO GITHUB =====
        // Requires GITHUB_TOKEN env var (Personal Access Token with repo write scope)
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = 'HKW875';
        const GITHUB_REPO  = 'trx-infosec-backend';
        const GITHUB_BRANCH = 'main';

        if (GITHUB_TOKEN && photoData.startsWith('data:image')) {
            try {
                // Extract base64 data (strip the data:image/...;base64, prefix)
                const matches = photoData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                if (matches && matches[2]) {
                    const ext        = matches[1].includes('png') ? 'png' : 'jpg';
                    const user       = await User.findOne({ email: req.user.email }).select('permanentID');
                    const filename   = `profile-photos/${(user && user.permanentID) || Date.now()}.${ext}`;
                    const base64Data = matches[2];
                    const apiUrl     = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;

                    // Check if file already exists (needed for update SHA)
                    let sha = undefined;
                    try {
                        const checkRes = await axios.get(apiUrl, {
                            headers: {
                                Authorization: `token ${GITHUB_TOKEN}`,
                                Accept: 'application/vnd.github.v3+json'
                            }
                        });
                        sha = checkRes.data.sha;
                    } catch (e) { /* file doesn't exist yet — create new */ }

                    const payload = {
                        message: `Upload profile photo for ${req.user.email}`,
                        content: base64Data,
                        branch:  GITHUB_BRANCH,
                        ...(sha ? { sha } : {})
                    };

                    const ghRes = await axios.put(apiUrl, payload, {
                        headers: {
                            Authorization: `token ${GITHUB_TOKEN}`,
                            Accept: 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        }
                    });

                    // Use raw GitHub URL so it can be displayed directly
                    photoUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filename}`;
                    console.log(`✅ Profile photo uploaded to GitHub: ${photoUrl}`);
                }
            } catch (ghErr) {
                console.error('GitHub photo upload failed, falling back to base64 storage:', ghErr.message);
                // photoUrl remains as base64 — still works, just stored in MongoDB
            }
        }

        await User.findOneAndUpdate({ email: req.user.email }, { profilePhoto: photoUrl });
        res.json({ success: true, photoUrl });
    } catch (err) {
        console.error('Profile photo save error:', err);
        res.status(500).json({ msg: 'Failed to save photo' });
    }
});

// ========================== WEB PUSH HELPER ==========================
// Send a push notification to all subscriptions stored for a user.
// Cleans up expired/invalid subscriptions automatically.
async function sendPushToUser(user, payload) {
    if (!user.pushSubscriptions || user.pushSubscriptions.length === 0) return;
    const toRemove = [];
    for (const sub of user.pushSubscriptions) {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
                JSON.stringify(payload),
                { TTL: 86400 } // keep queued for up to 24 h
            );
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                toRemove.push(sub.endpoint); // subscription expired
            }
        }
    }
    if (toRemove.length) {
        user.pushSubscriptions = user.pushSubscriptions.filter(s => !toRemove.includes(s.endpoint));
        await user.save();
    }
}

// ========================== ADMIN NOTIFICATION HELPER ==========================
// Sends an in-app notification + web push to wambuguhkw@gmail.com
// whenever any user submits a Goal or a new Ad.
const ADMIN_EMAIL = 'wambuguhkw@gmail.com';

async function notifyAdmin(title, body, tag) {
    try {
        const admin = await User.findOne({ email: ADMIN_EMAIL })
            .select('_id email pushSubscriptions');
        if (!admin) {
            console.warn(`⚠️  Admin user ${ADMIN_EMAIL} not found — skipping admin notification`);
            return;
        }

        // 1. Persist as an in-app GoalNotification so it appears in the bell panel
        await GoalNotification.create({
            userId:    admin._id,
            userEmail: admin.email,
            type:      'match',          // reuse existing type; renders fine in the panel
            message:   body,
            adTitle:   title,
            read:      false
        });

        // 2. Fire web push (works even when admin tab is closed)
        await sendPushToUser(admin, {
            title,
            body,
            icon:  '/icons/icon-192.png',
            badge: '/badge-72.png',
            tag,
            data:  { type: 'admin_alert' }
        });

        console.log(`🔔 Admin notified: ${title}`);
    } catch (err) {
        console.error('notifyAdmin error:', err);
    }
}

// ========================== GOAL MATCHING HELPER ==========================
// Haversine formula to calculate distance between two lat/lng points in km
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Match a single goal against all ads, create in-app + push notifications
// KEY FIX: geo/proximity is optional — if either side has no geo, still match on product+budget+category
async function matchGoalToAds(goal, userId, userEmail, userLat, userLng) {
    try {
        const query = {};
        if (goal.category) query.category = { $regex: new RegExp(goal.category, 'i') };

        const ads = await Advert.find(query);
        let matchCount = 0;

        for (const ad of ads) {
            // 1. Product keyword match
            const productWords = (goal.product || '').toLowerCase().split(/\s+/).filter(Boolean);
            const adText = `${ad.title} ${ad.description} ${ad.category}`.toLowerCase();
            const productMatch = productWords.length === 0 || productWords.some(w => adText.includes(w));
            if (!productMatch) continue;

            // 2. Budget match: ad price <= user budget
            if (goal.budget) {
                const userBudget = parseFloat(goal.budget.toString().replace(/[^0-9.]/g, ''));
                const adPrice = parseFloat((ad.price || '0').toString().replace(/[^0-9.]/g, ''));
                if (!isNaN(userBudget) && !isNaN(adPrice) && adPrice > userBudget) continue;
            }

            // 3. Proximity — ONLY filter by distance if BOTH sides have geo data
            let distance = null;
            if (userLat && userLng && ad.geo && ad.geo.lat && ad.geo.lng) {
                distance = parseFloat(haversineDistance(userLat, userLng, ad.geo.lat, ad.geo.lng).toFixed(2));
                if (distance > 10) continue; // outside 10km — skip
            }
            // If either side has no geo, we still match (no distance filter applied)

            // 4. Deduplicate
            const exists = await GoalNotification.findOne({ userId, adId: ad._id, type: 'match' });
            if (exists) continue;

            const distStr = distance !== null ? ` (${distance.toFixed(1)}km away)` : '';
            const msg = `🎯 A match for your goal "${goal.product}" was found: "${ad.title}" at KES ${ad.price}${distStr}`;
            await GoalNotification.create({
                userId, userEmail, goalId: goal._id, adId: ad._id,
                type: 'match', message: msg,
                adTitle: ad.title, adPrice: ad.price, adPhone: ad.phone,
                adLocation: ad.locationName, adCategory: ad.category,
                distance, read: false
            });
            matchCount++;

            // Send web push (works even when user is logged out)
            const userDoc = await User.findById(userId).select('pushSubscriptions');
            if (userDoc) {
                await sendPushToUser(userDoc, {
                    title: '🎯 GrowthBase: Match Found!',
                    body: msg,
                    icon: '/icons/icon-192.png',
                    tag: `match-${ad._id}`,
                    data: { type: 'match', adId: ad._id.toString() }
                });
            }
        }
        return matchCount;
    } catch (err) {
        console.error('Goal matching error:', err);
        return 0;
    }
}

// ========================== MY GOAL ROUTE ==========================
// POST /api/goals — saves a user goal, checks buyer matches, AND notifies nearby sellers
app.post('/api/goals', async (req, res) => {
    try {
        const { product, category, budget, desiredDate, notifyMe, latitude, longitude } = req.body;

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
                    // Use freshest location: body > stored
                    const userLat = latitude || (user.location && user.location.latitude);
                    const userLng = longitude || (user.location && user.location.longitude);

                    user.goals.push(goalData);
                    await user.save();
                    const savedGoal = user.goals[user.goals.length - 1];
                    console.log(`✅ Goal saved to user profile: ${decoded.email}`);

                    // ===== NOTIFY ADMIN OF NEW GOAL SUBMISSION =====
                    const goalDate    = desiredDate ? ` | Desired by: ${desiredDate}` : '';
                    const goalBudget  = budget      ? ` | Budget: KES ${budget}`       : '';
                    const goalCat     = category    ? ` | Category: ${category}`       : '';
                    const goalNotify  = notifyMe    ? ` | Notify me: ${notifyMe}`      : '';
                    const adminGoalBody = `📋 New Goal Submitted\nUser: ${decoded.email}\nProduct: ${product}${goalCat}${goalBudget}${goalDate}${goalNotify}`;
                    notifyAdmin(
                        '🎯 New Goal Submitted',
                        adminGoalBody,
                        `admin-goal-${savedGoal._id}`
                    );
                    // ===============================================

                    // Background: match buyer goals to existing ads + notify sellers
                    if (notifyMe !== 'no') {
                        // 1. Notify this buyer of matching ads
                        matchGoalToAds(savedGoal, user._id, user.email, userLat, userLng).then(count => {
                            if (count > 0) console.log(`🔔 ${count} buyer match notification(s) for ${user.email}`);
                        });

                        // 2. Notify sellers who have ads in the same category within 10km
                        notifySellersOfNewGoal(savedGoal, user._id, user.email, userLat, userLng);
                    }

                    return res.status(201).json({ msg: 'Goal saved! We\'ll notify you when a match is found.' });
                }
            } catch (tokenErr) {
                // Token invalid — fall through to anonymous save
            }
        }

        // Anonymous goal
        const newGoal = new Goal({ ...goalData, userEmail: null });
        await newGoal.save();

        // ===== NOTIFY ADMIN OF ANONYMOUS GOAL SUBMISSION =====
        const anonDate    = desiredDate ? ` | Desired by: ${desiredDate}` : '';
        const anonBudget  = budget      ? ` | Budget: KES ${budget}`       : '';
        const anonCat     = category    ? ` | Category: ${category}`       : '';
        const anonNotify  = notifyMe    ? ` | Notify me: ${notifyMe}`      : '';
        const anonGoalBody = `📋 New Anonymous Goal Submitted\nProduct: ${product}${anonCat}${anonBudget}${anonDate}${anonNotify}`;
        notifyAdmin(
            '🎯 New Goal Submitted (Anonymous)',
            anonGoalBody,
            `admin-goal-anon-${newGoal._id}`
        );
        // =====================================================

        // Still notify sellers for anonymous goals if location provided
        if (latitude && longitude && notifyMe !== 'no') {
            notifySellersOfNewGoal(newGoal, null, 'Anonymous', latitude, longitude);
        }

        console.log(`✅ Anonymous goal saved: ${product}`);
        return res.status(201).json({ msg: 'Goal saved successfully.' });

    } catch (err) {
        console.error('Goal save error:', err);
        res.status(500).json({ msg: 'Failed to save goal. Please try again.' });
    }
});

// ========================== SELLER NOTIFICATION HELPER ==========================
async function notifySellersOfNewGoal(goal, buyerId, buyerEmail, buyerLat, buyerLng) {
    try {
        const catQuery = goal.category
            ? { category: { $regex: new RegExp(goal.category, 'i') } }
            : {};
        const ads = await Advert.find(catQuery);

        for (const ad of ads) {
            // Proximity check — only filter by distance if BOTH buyer and ad have geo
            let distance = null;
            if (buyerLat && buyerLng && ad.geo && ad.geo.lat && ad.geo.lng) {
                distance = parseFloat(haversineDistance(buyerLat, buyerLng, ad.geo.lat, ad.geo.lng).toFixed(2));
                if (distance > 10) continue; // outside 10km, skip
            }
            // If geo missing on either side, still notify (no distance filter)

            // Find seller: first try postedBy on ad, then by phone match
            let seller = null;
            if (ad.postedBy) {
                seller = await User.findById(ad.postedBy).select('_id email fullName pushSubscriptions');
            } else if (ad.phone) {
                seller = await User.findOne({
                    $or: [{ mobileNumber: ad.phone }, { phone: ad.phone }]
                }).select('_id email fullName pushSubscriptions');
            }

            if (!seller) continue;
            if (buyerId && seller._id.toString() === buyerId.toString()) continue;

            // Deduplicate per seller+goal per 24h
            const recentSellerNotif = await SellerNotification.findOne({
                sellerId: seller._id,
                goalProduct: goal.product,
                goalCategory: goal.category,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            if (recentSellerNotif) continue;

            const distStr = distance !== null ? ` (${distance.toFixed(1)}km from buyer)` : '';
            const budgetStr = goal.budget ? ` Budget: KES ${goal.budget}.` : '';
            const msg = `🛒 New buyer in "${ad.category}"! Someone wants "${goal.product}".${budgetStr}${distStr} Open GrowthBase to chat.`;

            await SellerNotification.create({
                sellerId: seller._id,
                sellerEmail: seller.email,
                adId: ad._id,
                goalId: goal._id || null,
                message: msg,
                goalProduct: goal.product,
                goalBudget: goal.budget,
                goalCategory: goal.category,
                buyerLocation: buyerLat ? `${parseFloat(buyerLat).toFixed(4)},${parseFloat(buyerLng).toFixed(4)}` : null,
                distance,
                read: false
            });

            await sendPushToUser(seller, {
                title: '🛒 New Buyer Near You!',
                body: msg,
                icon: '/icons/icon-192.png',
                tag: `seller-goal-${ad._id}-${Date.now()}`,
                data: { type: 'seller_goal', adId: ad._id.toString() }
            });

            console.log(`🔔 Seller ${seller.email} notified of new goal: ${goal.product}`);
        }
    } catch (err) {
        console.error('Seller notification error:', err);
    }
}

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

// ========================== NOTIFICATIONS ROUTES ==========================
// GET /api/notifications — get all unread notifications for current user
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const notifications = await GoalNotification.find({
            userId: user._id
        }).sort({ createdAt: -1 }).limit(50);

        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to retrieve notifications.' });
    }
});

// POST /api/notifications/mark-read — mark all notifications as read
app.post('/api/notifications/mark-read', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        await GoalNotification.updateMany({ userId: user._id, read: false }, { read: true });
        res.json({ msg: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to mark notifications.' });
    }
});

// POST /api/notifications/mark-read/:id — mark single notification as read
app.post('/api/notifications/mark-read/:id', authMiddleware, async (req, res) => {
    try {
        await GoalNotification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ msg: 'Notification marked as read.' });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to mark notification.' });
    }
});

// ========================== SELLER NOTIFICATIONS ROUTES ==========================
app.get('/api/seller-notifications', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        const notifications = await SellerNotification.find({ sellerId: user._id })
            .sort({ createdAt: -1 }).limit(50);
        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to retrieve seller notifications.' });
    }
});

app.post('/api/seller-notifications/mark-read', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });
        await SellerNotification.updateMany({ sellerId: user._id, read: false }, { read: true });
        res.json({ msg: 'All seller notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to mark notifications.' });
    }
});

app.post('/api/seller-notifications/mark-read/:id', authMiddleware, async (req, res) => {
    try {
        await SellerNotification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ msg: 'Seller notification marked as read.' });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to mark notification.' });
    }
});

// ========================== COMBINED NOTIFICATIONS (buyer + seller) ==========================
app.get('/api/all-notifications', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const [buyerNotifs, sellerNotifs] = await Promise.all([
            GoalNotification.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30),
            SellerNotification.find({ sellerId: user._id }).sort({ createdAt: -1 }).limit(30)
        ]);

        // Merge and sort by date
        const merged = [
            ...buyerNotifs.map(n => ({ ...n.toObject(), notifRole: 'buyer' })),
            ...sellerNotifs.map(n => ({ ...n.toObject(), notifRole: 'seller' }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

        const unreadCount = merged.filter(n => !n.read).length;
        res.json({ notifications: merged, unreadCount });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to retrieve notifications.' });
    }
});

// ========================== WEB PUSH SUBSCRIPTION ROUTES ==========================
// GET /api/push/vapid-public-key — return VAPID public key for client
app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — save push subscription (works when logged in or out via guest token)
app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ msg: 'Invalid subscription object.' });
        }
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found.' });

        // Avoid duplicates
        const exists = user.pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            user.pushSubscriptions.push({
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                }
            });
            await user.save();
        }
        res.json({ msg: 'Push subscription saved.' });
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ msg: 'Failed to save push subscription.' });
    }
});

// POST /api/push/unsubscribe — remove a push subscription on logout
app.post('/api/push/unsubscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint } = req.body;
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found.' });
        user.pushSubscriptions = user.pushSubscriptions.filter(s => s.endpoint !== endpoint);
        await user.save();
        res.json({ msg: 'Subscription removed.' });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to remove subscription.' });
    }
});

// POST /api/proximity-check — called by frontend when user location changes
// Checks user's goals vs nearby ads (within 10km)
app.post('/api/proximity-check', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude) return res.json({ proximityAlerts: 0 });

        const user = await User.findOne({ email: req.user.email });
        if (!user || !user.goals || user.goals.length === 0) return res.json({ proximityAlerts: 0 });

        // Update user location
        user.location = { latitude, longitude, timestamp: new Date() };
        await user.save();

        // Get all ads with geo data
        const ads = await Advert.find({ 'geo.lat': { $ne: null }, 'geo.lng': { $ne: null } });
        let alertCount = 0;

        for (const goal of user.goals) {
            if (goal.notifyMe === 'no') continue;
            for (const ad of ads) {
                // Category match
                if (goal.category && ad.category &&
                    !ad.category.toLowerCase().includes(goal.category.toLowerCase()) &&
                    !goal.category.toLowerCase().includes(ad.category.toLowerCase())) continue;

                const distance = haversineDistance(latitude, longitude, ad.geo.lat, ad.geo.lng);
                if (distance <= 10) {  // Changed from 2km to 10km
                    // Deduplicate: one proximity alert per ad per 24h per user
                    const recentAlert = await GoalNotification.findOne({
                        userId: user._id,
                        adId: ad._id,
                        type: 'proximity',
                        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    });
                    if (!recentAlert) {
                        const msg = `📍 You're ${distance.toFixed(1)}km from a seller matching your goal "${goal.product}": "${ad.title}" at KES ${ad.price}`;
                        await GoalNotification.create({
                            userId: user._id,
                            userEmail: user.email,
                            goalId: goal._id,
                            adId: ad._id,
                            type: 'proximity',
                            message: msg,
                            adTitle: ad.title,
                            adPrice: ad.price,
                            adPhone: ad.phone,
                            adLocation: ad.locationName,
                            adCategory: ad.category,
                            distance: parseFloat(distance.toFixed(2)),
                            read: false
                        });
                        alertCount++;

                        // Push notification (works when logged out)
                        await sendPushToUser(user, {
                            title: '📍 GrowthBase: Seller Nearby!',
                            body: msg,
                            icon: '/icon-192.png',
                            badge: '/badge-72.png',
                            tag: `proximity-${ad._id}`,
                            data: { type: 'proximity', adId: ad._id.toString() }
                        });
                    }
                }
            }
        }

        res.json({ proximityAlerts: alertCount });
    } catch (err) {
        console.error('Proximity check error:', err);
        res.status(500).json({ msg: 'Proximity check failed.' });
    }
});

// POST /api/match-goals-for-new-ad — called when a new ad is posted
// Finds all users whose goals match this ad and creates notifications
app.post('/api/match-goals-for-new-ad', authMiddleware, async (req, res) => {
    try {
        const { adId } = req.body;
        if (!adId) return res.status(400).json({ msg: 'adId required' });

        const ad = await Advert.findById(adId);
        if (!ad) return res.status(404).json({ msg: 'Ad not found' });

        const adPrice = parseFloat((ad.price || '0').replace(/[^0-9.]/g, ''));
        const adText = `${ad.title} ${ad.description} ${ad.category}`.toLowerCase();

        // Find all users with goals that want notifications
        const users = await User.find({ 'goals.0': { $exists: true } }).select('_id email goals');
        let notifCount = 0;

        for (const user of users) {
            for (const goal of user.goals) {
                if (goal.notifyMe === 'no') continue;

                // Category match
                const catMatch = !goal.category || !ad.category ||
                    ad.category.toLowerCase().includes(goal.category.toLowerCase()) ||
                    goal.category.toLowerCase().includes(ad.category.toLowerCase());
                if (!catMatch) continue;

                // Product keyword match
                const productWords = (goal.product || '').toLowerCase().split(/\s+/).filter(Boolean);
                const productMatch = productWords.length === 0 || productWords.some(w => adText.includes(w));
                if (!productMatch) continue;

                // Budget match
                let budgetMatch = true;
                if (goal.budget) {
                    const userBudget = parseFloat(goal.budget.toString().replace(/[^0-9.]/g, ''));
                    if (!isNaN(userBudget) && !isNaN(adPrice)) {
                        budgetMatch = adPrice <= userBudget;
                    }
                }
                if (!budgetMatch) continue;

                // Check if notification already exists
                const exists = await GoalNotification.findOne({ userId: user._id, adId: ad._id, type: 'match' });
                if (!exists) {
                    await GoalNotification.create({
                        userId: user._id,
                        userEmail: user.email,
                        goalId: goal._id,
                        adId: ad._id,
                        type: 'match',
                        message: `🎯 A new listing matches your goal "${goal.product}": "${ad.title}" at KES ${ad.price}`,
                        adTitle: ad.title,
                        adPrice: ad.price,
                        adPhone: ad.phone,
                        adLocation: ad.locationName,
                        adCategory: ad.category,
                        read: false
                    });
                    notifCount++;
                }
            }
        }

        console.log(`🔔 New ad ${adId} matched ${notifCount} user goals`);
        res.json({ matched: notifCount });
    } catch (err) {
        console.error('Goal matching for new ad error:', err);
        res.status(500).json({ msg: 'Matching failed.' });
    }
});

// ========================== CHAT ROUTES ==========================

// GET /api/ads/:id/poster — get the poster info for an ad (to initiate chat)
app.get('/api/ads/:id/poster', authMiddleware, async (req, res) => {
    try {
        const ad = await Advert.findById(req.params.id).select('title postedBy postedByEmail phone category price');
        if (!ad) return res.status(404).json({ msg: 'Ad not found' });

        let posterName = 'Seller';
        let posterId = ad.postedBy;
        let posterEmail = ad.postedByEmail;

        if (!posterId && ad.phone) {
            const seller = await User.findOne({
                $or: [{ mobileNumber: ad.phone }, { phone: ad.phone }]
            }).select('_id email fullName');
            if (seller) {
                posterId = seller._id;
                posterEmail = seller.email;
                posterName = seller.fullName || seller.email;
            }
        } else if (posterId) {
            const seller = await User.findById(posterId).select('fullName email');
            if (seller) posterName = seller.fullName || seller.email;
        }

        res.json({ posterId, posterEmail, posterName, adTitle: ad.title, adId: ad._id });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to get poster info' });
    }
});

// ⚠️ CRITICAL: /api/chat/rooms/mine MUST be defined BEFORE /api/chat/:roomId
// Express matches routes in registration order — :roomId would capture "rooms" otherwise.

// GET /api/chat/rooms/mine — list all chat rooms this user is in
app.get('/api/chat/rooms/mine', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const messages = await ChatMessage.find({
            $or: [{ senderId: user._id }, { receiverId: user._id }]
        }).sort({ createdAt: -1 });

        const roomMap = {};
        for (const msg of messages) {
            if (!roomMap[msg.roomId]) {
                const isSender = msg.senderId.toString() === user._id.toString();
                roomMap[msg.roomId] = {
                    roomId:      msg.roomId,
                    adId:        msg.adId,
                    adTitle:     msg.adTitle,
                    lastMessage: msg.message,
                    lastAt:      msg.createdAt,
                    otherEmail:  isSender ? msg.receiverEmail : msg.senderEmail,
                    otherName:   isSender ? (msg.receiverEmail || 'User') : (msg.senderName || msg.senderEmail),
                    otherId:     isSender ? msg.receiverId : msg.senderId,
                    unread: 0
                };
            }
            if (!msg.read && msg.receiverId && msg.receiverId.toString() === user._id.toString()) {
                roomMap[msg.roomId].unread++;
            }
        }

        const rooms = Object.values(roomMap).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
        const totalUnread = rooms.reduce((sum, r) => sum + r.unread, 0);
        res.json({ rooms, totalUnread });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to load chat rooms' });
    }
});

// GET /api/chat/:roomId — get all messages for a room (registered AFTER rooms/mine)
app.get('/api/chat/:roomId', authMiddleware, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ roomId: req.params.roomId })
            .sort({ createdAt: 1 }).limit(100);

        const user = await User.findOne({ email: req.user.email });
        if (user) {
            await ChatMessage.updateMany(
                { roomId: req.params.roomId, receiverId: user._id, read: false },
                { read: true }
            );
        }
        res.json({ messages });
    } catch (err) {
        res.status(500).json({ msg: 'Failed to load messages' });
    }
});

// POST /api/chat/send — send a chat message
app.post('/api/chat/send', authMiddleware, async (req, res) => {
    try {
        const { roomId, adId, adTitle, receiverId, receiverEmail, message } = req.body;
        if (!message || !message.trim()) return res.status(400).json({ msg: 'Message cannot be empty' });
        if (!roomId) return res.status(400).json({ msg: 'roomId required' });

        const sender = await User.findOne({ email: req.user.email }).select('_id email fullName pushSubscriptions');
        if (!sender) return res.status(404).json({ msg: 'Sender not found' });

        const newMsg = await ChatMessage.create({
            roomId,
            adId:          adId || null,
            adTitle:       adTitle || null,
            senderId:      sender._id,
            senderEmail:   sender.email,
            senderName:    sender.fullName || sender.email,
            receiverId:    receiverId || null,
            receiverEmail: receiverEmail || null,
            message:       message.trim(),
            read: false
        });

        if (receiverId) {
            const receiver = await User.findById(receiverId).select('pushSubscriptions');
            if (receiver) {
                await sendPushToUser(receiver, {
                    title: `💬 Message from ${sender.fullName || sender.email}`,
                    body:  message.trim().slice(0, 120),
                    icon:  '/icons/icon-192.png',
                    tag:   `chat-${roomId}`,
                    data:  { type: 'chat', roomId, adId: adId || '' }
                });
            }
        }

        res.status(201).json({ msg: newMsg });
    } catch (err) {
        console.error('Chat send error:', err);
        res.status(500).json({ msg: 'Failed to send message' });
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
    const { email, password, mobileNumber, occupation, referredBy, referralPhone, referralEmail, confirmPassword, secretCode } = req.body;
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
            referredBy: referredBy || '',
            referralPhone: referralPhone || '',
            secretCode: hashedSecret,
            consentGiven: true,
            points: 0
        });

        if (email === 'wambuguhkw@gmail.com') {
            user.permanentID = '170320358';
        }

        await user.save();

        // ===== NOTIFY ADMIN OF NEW USER REGISTRATION (full details) =====
        const regBody = [
            `👤 New User Registered on GrowthBase`,
            ``,
            `📧 Email:        ${email}`,
            `📱 Mobile:       ${mobileNumber}`,
            `💼 Occupation:   ${occupation}`,
            `🆔 Profile ID:   ${user.permanentID}`,
            `📅 Registered:   ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`,
            referredBy     ? `👥 Referred By:  ${referredBy}` : null,
            referralPhone  ? `📞 Referral Ph:  ${referralPhone}` : null,
            referralEmail  ? `📨 Referral Em:  ${referralEmail}` : null,
        ].filter(Boolean).join('\n');
        notifyAdmin(
            '🆕 New User Registered',
            regBody,
            `admin-newuser-${user._id}`
        );
        // =============================================================

        // ===== REFERRAL POINTS CREDITING =====
        // Primary lookup: by referralEmail + mobileNumber (most reliable — email is unique and set at registration)
        // Fallback: by fullName + mobileNumber (legacy, for referrers who have set their full name in profile)
        let referrer = null;

        if (referralEmail) {
            // Most reliable: match by the referrer's email address
            const emailQuery = { email: referralEmail.toLowerCase().trim() };
            
            referrer = await User.findOne(emailQuery);
        }

        

        if (referrer) {
            // Prevent self-referral
            if (referrer.email !== email) {
                referrer.points = (referrer.points || 0) + 5;
                await referrer.save();
                console.log(`✅ 5 points credited to referrer: ${referrer.email}`);
            }
        } else {
            console.log(`ℹ️  No referrer found for referralEmail="${referralEmail}" referredBy="${referredBy}" referralPhone="${referralPhone}"`);
        }

        console.log('User registered successfully:', email);
        res.status(201).json({ msg: 'Account created successfully! You can now login.' });
    } catch (err) {
        console.error('Register error details:', err.message);
        res.status(500).json({ msg: 'Registration failed. Please try again.' });
    }
});

// POST: Create a new Ad + Award 4 points to poster
app.post('/api/ads/create', upload.array('images', 5), authMiddleware, async (req, res) => {
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
            },
            postedBy: null,      // filled below after user lookup
            postedByEmail: null
        });

        await newAd.save();

        // Award 4 points to the user who posted the ad
        const user = await User.findOne({ email: req.user.email });
        if (user) {
            user.points = (user.points || 0) + 4;
            await user.save();
            // Link ad to poster — save name + photo so cards show them without extra lookups
            newAd.postedBy      = user._id;
            newAd.postedByEmail = user.email;
            newAd.postedByName  = user.fullName    || null;
            newAd.postedByPhoto = user.profilePhoto || null;
            await newAd.save();
            console.log(`✅ 4 points awarded for posting ad to: ${user.email}`);
        }

        // ===== NOTIFY ADMIN OF NEW AD SUBMISSION =====
        const adCondition  = req.body.condition  ? ` | Condition: ${req.body.condition}`   : '';
        const adLocation   = req.body.locationName ? ` | Location: ${req.body.locationName}` : '';
        const adPhone      = req.body.phone      ? ` | Phone: ${req.body.phone}`           : '';
        const adDesc       = req.body.description ? ` | Description: ${req.body.description.slice(0, 120)}` : '';
        const adCategory   = req.body.category   ? ` | Category: ${req.body.category}`     : '';
        const adPostedBy   = req.user.email;
        const adminAdBody  = `📢 New Ad Posted\nUser: ${adPostedBy}\nTitle: ${req.body.title}\nPrice: KES ${req.body.price}${adCategory}${adCondition}${adLocation}${adPhone}${adDesc}`;
        notifyAdmin(
            '📢 New Ad Posted',
            adminAdBody,
            `admin-ad-${newAd._id}`
        );
        // =============================================

        // Trigger goal matching for this new ad (background, non-blocking)
        setTimeout(async () => {
            try {
                const adPrice = parseFloat((newAd.price || '0').replace(/[^0-9.]/g, ''));
                const adText = `${newAd.title} ${newAd.description} ${newAd.category}`.toLowerCase();
                const users = await User.find({ 'goals.0': { $exists: true } }).select('_id email goals location pushSubscriptions');
                let notifCount = 0;
                for (const u of users) {
                    for (const goal of u.goals) {
                        if (goal.notifyMe === 'no') continue;

                        // Category match
                        const catMatch = !goal.category || !newAd.category ||
                            newAd.category.toLowerCase().includes(goal.category.toLowerCase()) ||
                            goal.category.toLowerCase().includes(newAd.category.toLowerCase());
                        if (!catMatch) continue;

                        // Product match
                        const productWords = (goal.product || '').toLowerCase().split(/\s+/).filter(Boolean);
                        const productMatch = productWords.length === 0 || productWords.some(w => adText.includes(w));
                        if (!productMatch) continue;

                        // Budget match
                        if (goal.budget) {
                            const userBudget = parseFloat(goal.budget.toString().replace(/[^0-9.]/g, ''));
                            if (!isNaN(userBudget) && !isNaN(adPrice) && adPrice > userBudget) continue;
                        }

                        // Proximity — only filter if BOTH have geo; otherwise still match
                        let distance = null;
                        if (u.location && u.location.latitude && newAd.geo && newAd.geo.lat) {
                            distance = parseFloat(haversineDistance(u.location.latitude, u.location.longitude, newAd.geo.lat, newAd.geo.lng).toFixed(2));
                            if (distance > 10) continue;
                        }

                        const exists = await GoalNotification.findOne({ userId: u._id, adId: newAd._id, type: 'match' });
                        if (!exists) {
                            const distStr = distance !== null ? ` (${distance.toFixed(1)}km away)` : '';
                            const msg = `🎯 New listing matches your goal "${goal.product}": "${newAd.title}" at KES ${newAd.price}${distStr}`;
                            await GoalNotification.create({
                                userId: u._id, userEmail: u.email, goalId: goal._id, adId: newAd._id,
                                type: 'match', message: msg,
                                adTitle: newAd.title, adPrice: newAd.price, adPhone: newAd.phone,
                                adLocation: newAd.locationName, adCategory: newAd.category,
                                distance, read: false
                            });
                            notifCount++;
                            await sendPushToUser(u, {
                                title: '🎯 GrowthBase: New Match!',
                                body: msg,
                                icon: '/icons/icon-192.png',
                                tag: `match-${newAd._id}`,
                                data: { type: 'match', adId: newAd._id.toString() }
                            });
                        }
                    }
                }
                if (notifCount > 0) console.log(`🔔 New ad matched ${notifCount} user goals`);
            } catch (e) { console.error('Background goal matching error:', e); }
        }, 200);

        return res.status(201).json({
            success: true,
            message: 'Ad created successfully!',
            points: user ? user.points : 0
        });
    } catch (error) {
        console.error("CREATE AD ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        // ✅ ===== ADD IT HERE =====
        const now = Date.now();

        if (user.lastLoginTime && (now - user.lastLoginTime) < 10000) {
            return res.status(429).json({ msg: "Too many login attempts" });
        }

        user.lastLoginTime = now;
        // =========================

        const token = jwt.sign(
            { id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
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
            points: user.points,
            profilePhoto: user.profilePhoto || null,
            fullName: user.fullName || ''
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

app.get('/api/chat/search', authMiddleware, async (req, res) => {
    const { name } = req.query;
    const users = await User.find({
        customChatName: new RegExp(name, 'i'),
        allowChatSearch: true
    }).select('customChatName');
    res.json(users);
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
