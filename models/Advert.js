const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
    category: String,
    title: String,
    price: Number,
    description: String,
    locationName: String,
    phone: String,
    condition: { type: String, enum: ['new', 'used'] },
    images: [String],
    geo: {
        lat: Number,
        lng: Number
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Advert', AdSchema);
