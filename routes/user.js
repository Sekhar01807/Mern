const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const { signup, renderSignup, renderLogin, login, logout, toggleWishlist, showWishlist, showProfile, updateProfile } = require("../controllers/users.js");
const multer = require('multer');
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

router
   .route("/signup")
   .get(renderSignup)
   .post(wrapAsync(signup));

router
   .route("/login")
   .get(renderLogin)
   .post(saveRedirectUrl, passport.authenticate("local", { failureRedirect: '/login', failureFlash: true }), login);

router.get("/logout", logout);

// Wishlist
router.get("/wishlist", isLoggedIn, wrapAsync(showWishlist));
router.post("/wishlist/:id", isLoggedIn, wrapAsync(toggleWishlist));

// Profile
router.get("/profile", isLoggedIn, wrapAsync(showProfile));
router.put("/profile", isLoggedIn, upload.single("profileImage"), wrapAsync(updateProfile));

// Forgot Password
const { renderForgotForm, forgotPassword, renderResetForm, resetPassword } = require("../controllers/users.js");
router.get("/forgot", renderForgotForm);
router.post("/forgot", wrapAsync(forgotPassword));
router.get("/reset/:token", renderResetForm);
router.post("/reset/:token", wrapAsync(resetPassword));

module.exports = router;
