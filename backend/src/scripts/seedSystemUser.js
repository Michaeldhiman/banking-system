const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/user.model");
const Account = require("../models/account.model");

async function seedSystemUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        let systemUser = await User.findOne({ systemUser: true }).select("+systemUser");

        if (!systemUser) {
            systemUser = await User.create({
                name: process.env.SYSTEM_NAME || "Central Banking System",
                email: process.env.SYSTEM_EMAIL || "system@bank.com",
                password: process.env.SYSTEM_PASSWORD || "SystemPassword123",
                systemUser: true,
            });
            console.log("✅ System user created successfully.");
        } else {
            console.log("✅ System user already exists.");
        }

        // Ensure system user has a primary bank account
        const existingAccount = await Account.findOne({ user: systemUser._id });
        if (!existingAccount) {
            await Account.create({
                user: systemUser._id,
                currency: "INR",
                status: "Active"
            });
            console.log("✅ System account created successfully.");
        } else {
            console.log("✅ System account already exists.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Error seeding system user/account:", err);
        process.exit(1);
    }
}

seedSystemUser();