const express = require("express");
const router = express.Router();
const Booking = require("../models/booking.js");
const Message = require("../models/message.js");
const { isLoggedIn } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");

router.get("/summary", isLoggedIn, wrapAsync(async (req, res) => {
    const userId = req.user._id;
    const now = new Date();
    
    // 1. Fetch Booking Alerts
    // We look for paid bookings starting in the future
    const bookings = await Booking.find({ 
        user: userId, 
        paymentStatus: "paid",
        checkIn: { $gt: now }
    }).populate("listing");

    const bookingAlerts = [];
    bookings.forEach(b => {
        const diffTime = Math.abs(b.checkIn - now);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Alert on specific intervals: 1, 2, 5, 7 days
        if ([1, 2, 5, 7].includes(diffDays)) {
            bookingAlerts.push({
                type: "booking",
                days: diffDays,
                listingTitle: b.listing.title,
                listingId: b.listing._id,
                message: `Your trip to ${b.listing.title} is in ${diffDays} day${diffDays > 1 ? 's' : ''}! ✈️`
            });
        }
    });

    // 2. Fetch Unread Message Alerts
    const unreadMessages = await Message.find({
        receiver: userId,
        isRead: false
    }).populate("sender").populate("listing").sort({ createdAt: -1 });

    const messageAlerts = unreadMessages.map(m => ({
        type: "message",
        senderName: m.sender.username,
        senderId: m.sender._id,
        listingId: m.listing._id,
        content: m.content,
        message: `New message from @${m.sender.username} about ${m.listing.title}`
    }));

    res.json({
        success: true,
        alerts: [...bookingAlerts, ...messageAlerts]
    });
}));

module.exports = router;
