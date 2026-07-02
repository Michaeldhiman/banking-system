const accountModel = require("../models/account.model");
const mongoose = require("mongoose");
const transactionService = require("../services/transaction.service");

/**
 * Helper to sanitize account documents by converting to object and deleting internal Mongoose fields
 * @param {Object} account - Mongoose account document
 * @returns {Object} Sanitized account object
 */
function sanitizeAccount(account) {
    const obj = account.toObject();
    delete obj.__v;
    return obj;
}

/**
 * @desc Create a new account for the authenticated user
 * @route POST /api/v1/accounts
 * @access Private
 */
async function createAccountController(req, res) {
    // 1. Read request parameters
    const user = req.user;
    const { currency } = req.body;

    // 2. Validate input
    if (currency && (typeof currency !== "string" || currency.length !== 3)) {
        return res.status(400).json({
            status: "fail",
            message: "Currency must be a 3-letter uppercase code."
        });
    }

    let account;
    try {
        // 3. Query database/service to create account
        account = await accountModel.create({
            user: user._id,
            currency: currency ? currency.toUpperCase() : "INR"
        });
    } catch (err) {
        return res.status(400).json({
            status: "fail",
            message: err.message
        });
    }

    try {
        // Resolve system account for initial funding
        const systemAccount = await transactionService.getSystemAccount();
        
        // Generate deterministic idempotency key based on account ID
        const idempotencyKey = `init-${account._id}`;
        const initAmount = 100000; // 1,000.00 standard currency units (100,000 paise/cents)

        // Execute internal initial funding deposit
        await transactionService.deposit({
            systemAccountId: systemAccount._id,
            userAccountId: account._id,
            amount: initAmount,
            idempotencyKey,
            userEmail: req.user.email,
            userName: req.user.name,
            isInitialFunding: true
        });

        const balance = await account.getBalance();
        const accountData = sanitizeAccount(account);
        accountData.balance = balance;

        // 5. Return response
        return res.status(201).json({
            status: "success",
            message: "Account created and initialized successfully",
            data: accountData
        });

    } catch (err) {
        // Transactional Rollback: delete the newly created account if initial funding fails
        await accountModel.deleteOne({ _id: account._id });

        // 6. Handle unexpected errors
        return res.status(500).json({
            status: "fail",
            message: `Account creation aborted: Initial funding failed. Error: ${err.message}`
        });
    }
}

/**
 * @desc Get all accounts for the authenticated user
 * @route GET /api/v1/accounts
 * @access Private
 */
async function getAllAccountsController(req, res) {
    // 1. Read request parameters
    const user = req.user;

    try {
        // 3. Query database/service
        const accounts = await accountModel.find({ user: user._id });

        // Calculate balances dynamically for each account
        const data = await Promise.all(accounts.map(async (acc) => {
            const balance = await acc.getBalance();
            const sanitized = sanitizeAccount(acc);
            sanitized.balance = balance;
            return sanitized;
        }));

        // 5. Return response
        return res.status(200).json({
            status: "success",
            message: "Accounts retrieved successfully",
            data: data
        });
    } catch (err) {
        // 6. Handle unexpected errors
        return res.status(500).json({
            status: "fail",
            message: err.message
        });
    }
}

/**
 * @desc Get complete details of a specific account for the authenticated user (including balance)
 * @route GET /api/v1/accounts/:accountId
 * @access Private
 */
async function getAccountDetailsController(req, res) {
    // 1. Read request parameters
    const user = req.user;
    const { accountId } = req.params;

    // 2. Validate input
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({
            status: "fail",
            message: "Invalid accountId ID format"
        });
    }

    try {
        // 3. Query database/service
        const account = await accountModel.findOne({ _id: accountId, user: user._id });
        
        // 4. Handle not found
        if (!account) {
            return res.status(404).json({
                status: "fail",
                message: "Account not found"
            });
        }

        const balance = await account.getBalance();
        const accountData = sanitizeAccount(account);
        accountData.balance = balance;

        // 5. Return response
        return res.status(200).json({
            status: "success",
            message: "Account details retrieved successfully",
            data: accountData
        });
    } catch (err) {
        // 6. Handle unexpected errors
        return res.status(500).json({
            status: "fail",
            message: err.message
        });
    }
}

/**
 * @desc Update the status of a specific account for the authenticated user (Freeze/Unfreeze/Close)
 * @route PATCH /api/v1/accounts/:accountId
 * @access Private
 */
async function updateAccountStatusController(req, res) {
    // 1. Read request parameters
    const user = req.user;
    const { accountId } = req.params;
    const { status } = req.body;

    // 2. Validate input
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({
            status: "fail",
            message: "Invalid accountId ID format"
        });
    }

    if (!status || !["Active", "Frozen", "Closed"].includes(status)) {
        return res.status(400).json({
            status: "fail",
            message: "Status must be either Active, Frozen or Closed"
        });
    }

    try {
        // 3. Query database/service
        const account = await accountModel.findOne({ _id: accountId, user: user._id });
        
        // 4. Handle not found
        if (!account) {
            return res.status(404).json({
                status: "fail",
                message: "Account not found"
            });
        }

        // Apply state change
        account.status = status;
        await account.save();

        const balance = await account.getBalance();
        const accountData = sanitizeAccount(account);
        accountData.balance = balance;

        // 5. Return response
        return res.status(200).json({
            status: "success",
            message: "Account status updated successfully",
            data: accountData
        });
    } catch (err) {
        // 6. Handle unexpected errors
        return res.status(500).json({
            status: "fail",
            message: err.message
        });
    }
}

module.exports = {
    createAccountController,
    getAllAccountsController,
    getAccountDetailsController,
    updateAccountStatusController
};