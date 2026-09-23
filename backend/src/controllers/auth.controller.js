const userModel = require("../models/user.model");
const Blacklist = require("../models/blacklist.model");
const bcrypt = require("bcryptjs");
const { 
    generateAccessToken, 
    generateRefreshToken, 
    verifyRefreshToken 
} = require("../utils/jwt.utils");
const { sendRegistrationEmail } = require("../services/email.service");
const jwt = require("jsonwebtoken");

// Cookie configuration settings for development and production environments
const accessTokenCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000 // 15 minutes
};

const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/** 
 * @desc User registration controller
 * @route POST /api/v1/auth/register
 */
async function userRegisterController(req, res) {
    const { email, password, name } = req.body;

    const isExist = await userModel.findOne({ email });
    if (isExist) {
        return res.status(422).json({
            message: "User already exists with the email.",
            status: "failed"
        });
    }

    // 1. Create the user in MongoDB. Password will be automatically hashed by pre-save hook.
    const user = await userModel.create({ email, password, name });

    // 2. Generate new Access and Refresh tokens
    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });

    // 3. Hash the Refresh Token before storing it in MongoDB
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await userModel.findByIdAndUpdate(user._id, { refreshTokenHash: hashedRefreshToken });

    // 4. Send both tokens as HttpOnly cookies
    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    res.status(201).json({
        status: "success",
        user: {
            _id: user._id,
            email: user.email,
            name: user.name
        }
    });

    // 5. Send registration email asynchronously (fire-and-forget style)
    sendRegistrationEmail(user.email, user.name).catch((err) => {
        console.error("Error sending registration email:", err);
    });
}

/**
 * @desc User login controller
 * @route POST /api/v1/auth/login
 */
async function userLoginController(req, res) {
    const { email, password } = req.body;
    
    // Retrieve the user from MongoDB and explicitly select password field
    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
        return res.status(401).json({
            message: "Invalid credentials.",
            status: "failed"
        });
    }

    // Verify the password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        return res.status(401).json({
            message: "Invalid credentials.",
            status: "failed"
        });
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });

    // Hash the Refresh Token and store it in MongoDB
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await userModel.findByIdAndUpdate(user._id, { refreshTokenHash: hashedRefreshToken });

    // Send both tokens as HttpOnly cookies
    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    res.status(200).json({
        status: "success",
        user: {
            _id: user._id,
            email: user.email,
            name: user.name
        }
    });
}

/**
 * @desc Token refresh controller to renew Access Token using Refresh Token
 * @route POST /api/v1/auth/refresh
 */
async function refreshAccessTokenController(req, res) {
    const refreshToken = req.cookies.refreshToken;

    // Check if refresh token cookie is missing
    if (!refreshToken) {
        return res.status(401).json({
            message: "Missing token",
            status: "failed"
        });
    }

    try {
        // 1. Verify the refresh token's cryptographic signature and expiration
        const decoded = verifyRefreshToken(refreshToken);

        // 2. Fetch the user and include their stored refresh token hash
        const user = await userModel.findById(decoded.userId).select("+refreshTokenHash");
        if (!user) {
            return res.status(401).json({
                message: "Invalid refresh token",
                status: "failed"
            });
        }

        // 3. Compare the received plain refresh token with the stored bcrypt hash
        const isMatch = await user.compareRefreshToken(refreshToken);
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid refresh token",
                status: "failed"
            });
        }

        // 4. Generate a new short-lived Access Token
        const newAccessToken = generateAccessToken({ userId: user._id });

        // 5. Send the new Access Token in an HttpOnly cookie
        res.cookie("accessToken", newAccessToken, accessTokenCookieOptions);

        return res.status(200).json({
            message: "Token refreshed successfully",
            status: "success"
        });
    } catch (err) {
        return res.status(401).json({
            message: "Invalid refresh token",
            status: "failed"
        });
    }
}

/**
 * @desc User logout controller
 * @route POST /api/v1/auth/logout
 */
async function userLogoutController(req, res) {
    const accessToken = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    // Blacklist the active access token so it cannot be reused
    if (accessToken) {
        try {
            await Blacklist.create({ token: accessToken });
        } catch (err) {
            // Token might already be blacklisted, safe to ignore duplicate error
        }
    }

    if (refreshToken) {
        try {
            // Attempt to verify and decode the token
            const decoded = verifyRefreshToken(refreshToken);
            
            // Remove the stored refresh token hash from MongoDB
            await userModel.findByIdAndUpdate(decoded.userId, {
                $unset: { refreshTokenHash: 1 }
            });
        } catch (err) {
            // Fallback: If token expired, decode it anyway without signature checks to find user and clear DB hash
            try {
                const decoded = jwt.decode(refreshToken);
                if (decoded && decoded.userId) {
                    await userModel.findByIdAndUpdate(decoded.userId, {
                        $unset: { refreshTokenHash: 1 }
                    });
                }
            } catch (decodeErr) {
                // Ignore decode errors
            }
        }
    }

    // Clear both cookies from the browser
    res.clearCookie("accessToken", accessTokenCookieOptions);
    res.clearCookie("refreshToken", refreshTokenCookieOptions);

    res.status(200).json({
        message: "Logout success",
        status: "success"
    });
}

/**
 * @desc Get details of the currently logged-in user
 * @route GET /api/v1/auth/me
 * @access Private
 */
async function getMeController(req, res) {
    return res.status(200).json({
        status: "success",
        data: req.user
    });
}

/**
 * @desc Update password of the currently logged-in user
 * @route PATCH /api/v1/auth/change-password
 * @access Private
 */
async function changePasswordController(req, res) {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({
            status: "failed",
            message: "Both oldPassword and newPassword are required."
        });
    }

    if (newPassword.length < 6 || newPassword.length > 16) {
        return res.status(400).json({
            status: "failed",
            message: "New password must be between 6 and 16 characters long."
        });
    }

    if (oldPassword === newPassword) {
        return res.status(400).json({
            status: "failed",
            message: "New password cannot be the same as the old password."
        });
    }

    try {
        // Fetch the user including the password field
        const user = await userModel.findById(req.user._id).select("+password");
        if (!user) {
            return res.status(404).json({
                status: "failed",
                message: "User not found."
            });
        }

        // Compare oldPassword with saved hash
        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) {
            return res.status(401).json({
                status: "failed",
                message: "Incorrect current password."
            });
        }

        // Update the password (pre-save hook will hash it)
        user.password = newPassword;
        await user.save();

        return res.status(200).json({
            status: "success",
            message: "Password changed successfully"
        });

    } catch (err) {
        return res.status(500).json({
            status: "failed",
            message: "Internal server error.",
            error: err.message
        });
    }
}

module.exports = {
    userRegisterController,
    userLoginController,
    refreshAccessTokenController,
    userLogoutController,
    getMeController,
    changePasswordController
};