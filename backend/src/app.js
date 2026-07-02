const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

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

// Mount Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/transactions", transactionRoutes);

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