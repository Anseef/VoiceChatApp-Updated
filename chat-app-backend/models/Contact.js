const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    lastMessage: String,
    time: String,
    unread: Number,
    image: String,
});

// --- FIX: The third argument ('Contact') tells Mongoose to use the collection ---
// --- with that exact name, solving the naming mismatch. ---
module.exports = mongoose.model('Contact', contactSchema, 'Contact');