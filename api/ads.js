import dbConnect from '../../lib/dbConnect'; // Your DB connection helper
import Ad from '../../models/Ad';

export default async function handler(req, res) {
    await dbConnect();

    if (req.method === 'POST') {
        try {
            const ad = await Ad.create(req.body);
            res.status(201).json({ success: true, data: ad });
        } catch (error) {
            res.status(400).json({ success: false });
        }
    } else if (req.method === 'GET') {
        try {
            const ads = await Ad.find({}).sort({ createdAt: -1 });
            res.status(200).json({ success: true, data: ads });
        } catch (error) {
            res.status(400).json({ success: false });
        }
    }
}
