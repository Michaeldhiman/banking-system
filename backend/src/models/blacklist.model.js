const mongoose = require("mongoose");

const blacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, "Token is required"],
        unique:[true, "Token already exists in the blacklist"]
    },
    
},{ timestamps: true });

blacklistSchema.index({createdAt: 1},{
    expireAfterSeconds: 60*60*24*3 // 3 days
});

const Blacklist = mongoose.model("Blacklist", blacklistSchema);

module.exports = Blacklist;