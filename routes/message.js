const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const Message = require("../models/message");
const Listing = require("../models/listing");

// Render Inbox Page
router.get("/", isLoggedIn, (req, res) => {
    res.render("messages/index.ejs");
});

// Get Unique Conversations for Inbox
router.get("/inbox-data", isLoggedIn, wrapAsync(async (req, res) => {
    // Find all messages involving the user
    // We group by listing and the other user
    const messages = await Message.find({
        $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    })
    .sort({ createdAt: -1 })
    .populate("sender", "username profileImage")
    .populate("receiver", "username profileImage")
    .populate("listing", "title");

    // Filter for unique conversations (Last message per user+listing pair)
    const uniqueConvos = [];
    const seen = new Set();

    for (let msg of messages) {
        const otherUser = msg.sender._id.equals(req.user._id) ? msg.receiver : msg.sender;
        if (!otherUser) continue;
        
        const key = `${otherUser._id}-${msg.listing?._id}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueConvos.push(msg);
        }
    }

    res.json(uniqueConvos);
}));

// Get Chat History
router.get("/:receiverId", isLoggedIn, wrapAsync(async (req, res) => {
    const { receiverId } = req.params;
    const { listingId } = req.query;
    
    const messages = await Message.find({
        $or: [
            { sender: req.user._id, receiver: receiverId },
            { sender: receiverId, receiver: req.user._id }
        ],
        listing: listingId
    }).sort({ createdAt: 1 }).populate("sender", "username profileImage");

    // Mark as read while fetching
    await Message.updateMany(
        { sender: receiverId, receiver: req.user._id, listing: listingId, isRead: false },
        { $set: { isRead: true } }
    );

    res.json(messages);
}));

const mongoose = require("mongoose");

// Send Message
router.post("/", isLoggedIn, wrapAsync(async (req, res) => {
    let { receiverId, listingId, content } = req.body;
    
    console.log("Incoming Message Data:", { receiverId, listingId, contentLen: content?.length });

    if (!receiverId || !listingId || !content) {
        return res.status(400).json({ message: "Missing required fields (receiverId, listingId, or content)" });
    }

    try {
        // Force conversion to ObjectId to be safe
        const sender = new mongoose.Types.ObjectId(req.user._id);
        const receiver = new mongoose.Types.ObjectId(receiverId);
        const listing = new mongoose.Types.ObjectId(listingId);

        const newMessage = new Message({
            sender,
            receiver,
            listing,
            content: content.trim()
        });

        await newMessage.save();
        console.log("Message Saved Successfully ID:", newMessage._id);
        res.json(newMessage);
    } catch (err) {
        console.error("CRITICAL Message Save Error:", err);
        res.status(500).json({ message: "Database Error: " + err.message });
    }
}));

// Delete Entire Conversation
router.delete("/:receiverId", isLoggedIn, wrapAsync(async (req, res) => {
    const { receiverId } = req.params;
    const { listingId } = req.query;

    await Message.deleteMany({
        $or: [
            { sender: req.user._id, receiver: receiverId },
            { sender: receiverId, receiver: req.user._id }
        ],
        listing: listingId
    });

    res.json({ success: true, message: "Conversation deleted" });
}));

module.exports = router;
