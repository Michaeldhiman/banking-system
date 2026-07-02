const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/user.model");

async function seedSystemUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const existing = await User.findOne({ systemUser: true }).select("+systemUser");

        if (existing) {
            console.log("✅ System user already exists.");
            process.exit(0);
        }

       

        await User.create({
            name: process.env.SYSTEM_NAME,
            email: process.env.SYSTEM_EMAIL,
            password: process.env.SYSTEM_PASSWORD,
            systemUser: true,
        });

        console.log("✅ System user created successfully.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedSystemUser();