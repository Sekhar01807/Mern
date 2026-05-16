const User = require("../models/user.js");
const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const Message = require("../models/message");
const crypto = require("crypto");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../utils/emailService");

module.exports.renderSignup = (req, res) => {
    res.render("users/signup.ejs");
};

module.exports.signup = async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, async (err) => {
            if (err) {
                return next(err);
            }
            await sendWelcomeEmail(registeredUser);
            req.flash("success", "Welcome to WanderLust! Your account has been created.");
            let redirectUrl = req.session.redirectUrl || "/listings";
            delete req.session.redirectUrl;
            res.redirect(redirectUrl);
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

module.exports.renderLogin = (req, res) => {
    res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
    req.flash("success", "Welcome back to WanderLust! 🌍");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            next(err);
        }
        req.flash("success", "you are logged out!");
        res.redirect("/listings");
    });
};

module.exports.toggleWishlist = async (req, res) => {
    let { id } = req.params;
    let user = await User.findById(req.user._id);
    const idx = user.wishlist.indexOf(id);
    let wishlisted;
    if (idx === -1) {
        user.wishlist.push(id);
        wishlisted = true;
    } else {
        user.wishlist.splice(idx, 1);
        wishlisted = false;
    }
    await user.save();

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
        return res.json({ wishlisted });
    }
    req.flash("success", wishlisted ? "Added to Wishlist ❤️" : "Removed from Wishlist");
    res.redirect("back");
};

module.exports.showWishlist = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.render("listings/index.ejs", {
        allListings: user.wishlist,
        search: "",
        category: "wishlist",
    });
};

module.exports.showProfile = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    const userListings = await Listing.find({ owner: req.user._id });
    
    const Booking = require("../models/booking");
    const userBookings = await Booking.find({ user: req.user._id }).populate("listing").sort({ checkIn: 1 });

    const userReviews = await Review.find({ author: req.user._id }).sort({ createdAt: -1 });
    let reviewsWithListings = [];
    for(let r of userReviews) {
        let listing = await Listing.findOne({ reviews: r._id });
        if(listing) {
            reviewsWithListings.push({ review: r, listing: listing });
        }
    }

    const userMessages = await Message.find({
        $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    }).populate("sender receiver listing").sort({ createdAt: -1 });

    const conversations = [];
    const seenConvos = new Set();
    for (let msg of userMessages) {
        const otherUser = msg.sender._id.equals(req.user._id) ? msg.receiver : msg.sender;
        const convoId = `${msg.listing._id}_${otherUser._id}`;
        if (!seenConvos.has(convoId)) {
            seenConvos.add(convoId);
            conversations.push({
                lastMessage: msg,
                otherUser,
                listing: msg.listing
            });
        }
    }
    
    res.render("users/profile.ejs", { user, userListings, reviewsWithListings, userBookings, conversations });
};

module.exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { username, country, bio, role, phoneNumber, languages } = req.body;

        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                req.flash("error", "Username is already taken. Please choose another one.");
                return res.redirect("/profile");
            }
            user.username = username;
        }

        if (country !== undefined) user.country = country;
        if (bio !== undefined) user.bio = bio;
        if (role !== undefined) user.role = role;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (languages !== undefined) user.languages = languages;

        if (typeof req.file !== "undefined") {
            let url = req.file.path;
            let filename = req.file.filename;
            user.profileImage = { url, filename };
        }

        await user.save();
        
        req.login(user, (err) => {
            if (err) {
                req.flash("error", "Error updating session");
                return res.redirect("/profile");
            }
            req.flash("success", "Profile updated successfully!");
            res.redirect("/profile");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/profile");
    }
};

module.exports.renderForgotForm = (req, res) => {
    res.render("users/forgot.ejs");
};

module.exports.forgotPassword = async (req, res) => {
    const token = crypto.randomBytes(20).toString("hex");
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        req.flash("error", "No account with that email address exists.");
        return res.redirect("/forgot");
    }

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    await sendPasswordResetEmail(user, req.headers.host, token);
    req.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
    res.redirect("/forgot");
};

module.exports.renderResetForm = async (req, res) => {
    const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot");
    }
    res.render("users/reset.ejs", { token: req.params.token });
};

module.exports.resetPassword = async (req, res) => {
    const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot");
    }

    if (req.body.password === req.body.confirm) {
        await user.setPassword(req.body.password);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        req.login(user, (err) => {
            req.flash("success", "Success! Your password has been changed.");
            res.redirect("/listings");
        });
    } else {
        req.flash("error", "Passwords do not match.");
        res.redirect("back");
    }
};
