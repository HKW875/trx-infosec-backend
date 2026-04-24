const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
    title: String,
    category: String,
    description: String,
    price: Number,
    location: String,
    phone: String,
    images: [String], // Array of Base64 strings
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Ad || mongoose.model('Ad', AdSchema);
