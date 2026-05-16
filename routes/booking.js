const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const { sendBookingEmail } = require("../utils/emailService");
// Stripe Initialization with Safety Check
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ CRITICAL ERROR: STRIPE_SECRET_KEY is missing from .env!");
}
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.trim() : "");

router.post("/checkout", isLoggedIn, wrapAsync(async (req, res) => {
    console.log("💳 STRIPE: Initializing checkout for listing:", req.params.id);
    const { id } = req.params;
    const { checkIn, checkOut, guests } = req.body;
    
    const listing = await Listing.findById(id);
    if (!listing) {
        console.error("❌ STRIPE ERROR: Listing not found during checkout");
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    const listingPrice = listing.price || 0;
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)) || 1;
    const guestsNum = parseInt(guests) || 1;
    const extraCharge = guestsNum > 1 ? (guestsNum - 1) * 0.25 * listingPrice : 0;
    const amount = nights * (listingPrice + extraCharge);

    if (isNaN(amount) || amount <= 0) {
        console.error("❌ STRIPE ERROR: Invalid booking amount calculated:", amount);
        req.flash("error", "Invalid booking details. Please check your dates and guests.");
        return res.redirect(`/listings/${id}`);
    }

    console.log(`📊 STRIPE: Total amount to charge: ₹${amount}`);

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "inr",
                    product_data: {
                        name: listing.title,
                        description: `Stay from ${checkIn} to ${checkOut}`,
                    },
                    unit_amount: Math.round(amount * 100),
                },
                quantity: 1,
            }],
            mode: "payment",
            success_url: `${req.protocol}://${req.get("host")}/listings/${id}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get("host")}/listings/${id}`,
            metadata: { checkIn, checkOut, guests, listingId: id, userId: req.user._id.toString() }
        });

        console.log("✅ STRIPE: Session created successfully. Redirecting to:", session.url);
        res.redirect(303, session.url);
    } catch (err) {
        console.error("❌ STRIPE API ERROR:", err.message);
        req.flash("error", "Stripe Connection Error: " + err.message);
        res.redirect(`/listings/${id}`);
    }
}));

router.get("/success", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    
    if (session.payment_status === "paid") {
        const { checkIn, checkOut, guests } = session.metadata;
        const listing = await Listing.findById(id);
        
        const booking = new Booking({
            listing: id,
            user: req.user._id,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            guests: parseInt(guests),
            totalPrice: session.amount_total / 100,
            paymentStatus: "paid",
            stripeSessionId: session.id
        });

        await booking.save();
        await sendBookingEmail(req.user, booking, listing);

        req.flash("success", "Booking confirmed and payment successful! 🎉 Check your email for details.");
        res.redirect(`/listings/${id}`);
    } else {
        req.flash("error", "Payment failed. Please try again.");
        res.redirect(`/listings/${id}`);
    }
}));

// DELETE Route for Cancellation
router.delete("/:bookingId", isLoggedIn, wrapAsync(async (req, res) => {
    const { id, bookingId } = req.params;
    await Booking.findByIdAndDelete(bookingId);
    req.flash("success", "Reservation cancelled successfully. We hope to see you again soon!");
    res.redirect(`/listings/${id}`);
}));

module.exports = router;
