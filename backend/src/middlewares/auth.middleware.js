const userModel = require("../models/user.model");
const Blacklist = require("../models/blacklist.model");
const { verifyAccessToken } = require("../utils/jwt.utils");

/**
 * @desc Middleware to authenticate requests using HttpOnly Access Token cookie
 */
async function authMiddleware(req, res, next) {
    // 1. Read access token from HttpOnly cookies (or Authorization header as fallback)
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

    // 2. Return 401 if the token is missing
    if (!token) {
        return res.status(401).json({
            status: "failed",
            message: "Missing token"
        });
    }

    try {
        // 3. Check if token has been blacklisted (e.g., after logout)
        const isBlacklisted = await Blacklist.findOne({ token });
        if (isBlacklisted) {
            return res.status(401).json({
                status: "failed",
                message: "Token has been revoked"
            });
        }

        // 4. Verify the access token using the utility function
        const decoded = verifyAccessToken(token);

        // 4. Retrieve the user from DB (excluding password) and attach to req.user
        const user = await userModel.findById(decoded.userId).select("-password");
        if (!user) {
            return res.status(401).json({
                status: "failed",
                message: "User not found"
            });
        }

        req.user = user;
        return next();
    } catch (err) {
        // 5. Check if the error is due to token expiration
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                status: "failed",
                message: "Expired token"
            });
        }
        
        // 6. Otherwise, return invalid token error
        return res.status(401).json({
            status: "failed",
            message: "Invalid token"
        });
    }
}

module.exports = {
    authMiddleware
};