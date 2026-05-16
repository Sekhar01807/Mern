const sgMail = require('@sendgrid/mail');
const nodemailer = require("nodemailer");

// Configure SendGrid SDK
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY.trim());
    console.log("✅ Email Service: SENDGRID SDK (Web API Mode)");
} else {
    console.log("⚠️  Email Service: MAILTRAP (Sandbox Mode)");
}

// Shared Styling for Premium Emails
const emailStyles = `
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #ff385c, #e03150); padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; letter-spacing: 1px; }
    .content { padding: 40px; background: #fff; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999; }
    .btn { display: inline-block; padding: 14px 30px; background: #ff385c; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
    .info-box { background: #fef1f2; border-left: 4px solid #ff385c; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .footer-links a { color: #ff385c; text-decoration: none; margin: 0 10px; }
`;

const sendViaSendGrid = async (msg) => {
    try {
        const response = await sgMail.send(msg);
        console.log(`🚀 SENT: Email delivered (Status: ${response[0].statusCode}) to: ${msg.to}`);
        return true;
    } catch (error) {
        console.error("❌ SendGrid SDK Error:", error.message);
        if (error.response) {
            console.error("Full Error Body:", JSON.stringify(error.response.body, null, 2));
        }
        return false;
    }
};

const sendViaMailtrap = async (mailOptions) => {
    const transporter = nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    try {
        await transporter.sendMail(mailOptions);
        console.log("⚠️  SENT: Email delivered via MAILTRAP FALLBACK to:", mailOptions.to);
    } catch (error) {
        console.error("❌ Mailtrap Error:", error.message);
    }
};

module.exports.sendWelcomeEmail = async (user) => {
    const msg = {
        to: user.email,
        from: process.env.FROM_EMAIL,
        subject: "Welcome to WanderLust! 🌍",
        html: `
            <html>
                <head><style>${emailStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>WanderLust</h1>
                        </div>
                        <div class="content">
                            <h2 style="color: #222;">Hi ${user.username}!</h2>
                            <p>We're absolutely thrilled to have you join our global community of adventurers. Your journey to finding the most unique stays around the world starts today.</p>
                            <p>Whether you're looking for a cozy cabin or a luxury villa, WanderLust has the perfect place waiting for you.</p>
                            <a href="http://localhost:8080/listings" class="btn">Start Exploring Now</a>
                        </div>
                        <div class="footer">
                            <p>&copy; 2026 WanderLust Inc. | All rights reserved.</p>
                            <div class="footer-links">
                                <a href="#">Terms</a> • <a href="#">Privacy</a> • <a href="#">Help Center</a>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `,
    };

    if (process.env.SENDGRID_API_KEY) {
        const success = await sendViaSendGrid(msg);
        if (!success) await sendViaMailtrap(msg);
    } else {
        await sendViaMailtrap(msg);
    }
};

module.exports.sendBookingEmail = async (user, booking, listing) => {
    const msg = {
        to: user.email,
        from: process.env.FROM_EMAIL,
        subject: "Your Adventure is Confirmed! 🎉",
        html: `
            <html>
                <head><style>${emailStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Booking Confirmed</h1>
                        </div>
                        <div class="content">
                            <h2 style="color: #222;">Get Your Bags Ready, ${user.username}!</h2>
                            <p>Your reservation at <strong>${listing.title}</strong> is officially confirmed. We've notified the host and everything is set for your arrival.</p>
                            
                            <div class="info-box">
                                <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${listing.location}, ${listing.country}</p>
                                <p style="margin: 5px 0;"><strong>📅 Check-in:</strong> ${new Date(booking.checkIn).toDateString()}</p>
                                <p style="margin: 5px 0;"><strong>📅 Check-out:</strong> ${new Date(booking.checkOut).toDateString()}</p>
                                <p style="margin: 5px 0; color: #ff385c;"><strong>💰 Total Paid:</strong> ₹${booking.totalPrice.toLocaleString("en-IN")}</p>
                            </div>

                            <p>You can manage your booking and message the host directly from your dashboard.</p>
                            <a href="http://localhost:8080/profile" class="btn">View Booking Details</a>
                        </div>
                        <div class="footer">
                            <p>Need help? Contact our 24/7 support team.</p>
                            <p>&copy; 2026 WanderLust Inc. | All rights reserved.</p>
                        </div>
                    </div>
                </body>
            </html>
        `,
    };

    if (process.env.SENDGRID_API_KEY) {
        const success = await sendViaSendGrid(msg);
        if (!success) await sendViaMailtrap(msg);
    } else {
        await sendViaMailtrap(msg);
    }
};

module.exports.sendPasswordResetEmail = async (user, host, token) => {
    const resetUrl = `http://${host}/reset/${token}`;
    const msg = {
        to: user.email,
        from: process.env.FROM_EMAIL,
        subject: "Secure Password Reset 🔒",
        html: `
            <html>
                <head><style>${emailStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Security Reset</h1>
                        </div>
                        <div class="content">
                            <h2 style="color: #222;">Password Reset Request</h2>
                            <p>We received a request to reset the password for your WanderLust account. Click the button below to choose a new password.</p>
                            <div style="text-align: center;">
                                <a href="${resetUrl}" class="btn">Reset My Password</a>
                            </div>
                            <p style="margin-top: 30px; font-size: 13px; color: #888;">If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2026 WanderLust Inc. | All rights reserved.</p>
                        </div>
                    </div>
                </body>
            </html>
        `,
    };

    if (process.env.SENDGRID_API_KEY) {
        const success = await sendViaSendGrid(msg);
        if (!success) await sendViaMailtrap(msg);
    } else {
        await sendViaMailtrap(msg);
    }
};
