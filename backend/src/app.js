const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

// Import Routes
const authRoutes = require("./routes/auth.routes");
const accountRoutes = require("./routes/account.routes");
const transactionRoutes = require("./routes/transaction.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));

// Rate limiting configurations
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 auth requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: "fail",
        message: "Too many authentication attempts from this IP, please try again after 15 minutes."
    }
});

const transactionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 transaction requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: "fail",
        message: "Too many transaction requests from this IP, please try again after 15 minutes."
    }
});

// Mount Routes with Rate Limiting
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/transactions", transactionLimiter, transactionRoutes);

// Root path handler
app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to the banking system backend API"
    });
});

// Catch-all 404 Route handler
app.use((req, res) => {
    res.status(404).json({
        status: "fail",
        message: `Route ${req.originalUrl} not found`
    });
});

// Centralized error handler
app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
        status: "fail",
        message: err.message || "Internal Server Error"
    });
});

module.exports = app;