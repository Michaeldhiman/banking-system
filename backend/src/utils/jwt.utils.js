const jwt = require("jsonwebtoken");

/**
 * @desc Generate a short-lived JWT Access Token
 * @param {Object} payload - Data to encode (e.g., { userId: user._id })
 * @returns {string} Signed JWT Access Token
 */
function generateAccessToken(payload) {
    // Read the secret and expiration from environment variables
    return jwt.sign(
        payload, 
        process.env.ACCESS_TOKEN_SECRET, 
        { 
            expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m" 
        }
    );
}

/**
 * @desc Generate a long-lived JWT Refresh Token
 * @param {Object} payload - Data to encode (e.g., { userId: user._id })
 * @returns {string} Signed JWT Refresh Token
 */
function generateRefreshToken(payload) {
    // Read the secret and expiration from environment variables
    return jwt.sign(
        payload, 
        process.env.REFRESH_TOKEN_SECRET, 
        { 
            expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "7d" 
        }
    );
}

/**
 * @desc Verify the JWT Access Token signature and expiration
 * @param {string} token - The access token string
 * @returns {Object} Decoded token payload if valid
 * @throws {Error} If token is expired, malformed, or signature is invalid
 */
function verifyAccessToken(token) {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

/**
 * @desc Verify the JWT Refresh Token signature and expiration
 * @param {string} token - The refresh token string
 * @returns {Object} Decoded token payload if valid
 * @throws {Error} If token is expired, malformed, or signature is invalid
 */
function verifyRefreshToken(token) {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};
