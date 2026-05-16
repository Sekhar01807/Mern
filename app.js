require('dotenv').config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
// Session Store Setup
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

// Security Packages
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// Initialize Cron Jobs for Email Reminders
require("./utils/cronJobs.js");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


const dbUrl = process.env.ATLASDB_URL;

main()
    .then(() => {
        console.log("connected to DB");
    })
    .catch((err) => {
        console.log(err);
    });

async function main() {
    await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

// Helmet (Security Headers) - Highly Permissive for Development/Production
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https://res.cloudinary.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://api.mapbox.com", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://js.stripe.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com", "https://unpkg.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://kit.fontawesome.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.unsplash.com", "https://*.mapbox.com", "https://*.stripe.com"],
            connectSrc: ["'self'", "*", "blob:", "data:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://ka-f.fontawesome.com"],
            frameSrc: ["'self'", "https://js.stripe.com"],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"],
            formAction: ["'self'", "https://checkout.stripe.com"],
        },
    },
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
}));

// Rate Limiting (Prevent Brute Force)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use("/login", limiter);
app.use("/signup", limiter);

const store = require('connect-mongo').default.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 3600,
    crypto: {
        secret: process.env.SECRET,
    }
});

store.on("error", () => {
    console.log("ERROR IN MONGO SESSION STORE", err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        expires: Date.now() + 14 * 24 * 60 * 60 * 1000,
        maxAge: 14 * 24 * 60 * 60 * 1000, 
    },
};





app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user || null;
    res.locals.mapToken = process.env.MAP_TOKEN;
    next();
});

// Landing page
app.get("/", (req, res) => {
    res.render("listings/landing.ejs");
});

const bookingRouter = require("./routes/booking.js");

const messageRouter = require("./routes/message.js");
const notificationRouter = require("./routes/notification.js");

// Mount routes
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/listings/:id/booking", bookingRouter);
app.use("/messages", messageRouter);
app.use("/notifications", notificationRouter);
app.use("/", userRouter);

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get(/^\/\.well-known\/.*/, (req, res) => res.status(204).end());

app.all(/(.*)/, (req, res, next) => {
    console.log("Hit 404 handler for:", req.url);
    next(new ExpressError(404, "Page not Found !"));
});


app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    
    let { statusCode = 500, message = "Something went wrong!" } = err;
    
    // FORCE JSON for all chat-related requests
    if (req.url.includes('/messages') || req.headers['content-type'] === 'application/json') {
        console.error("API Error caught:", message);
        return res.status(statusCode).json({ success: false, message: message });
    }
    
    res.status(statusCode).render("error.ejs", { message });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`listening to the port ${port}: `);
});