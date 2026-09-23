const mongoose = require("mongoose");
const AccountModel = require("../models/account.model");
const transactionService = require("../services/transaction.service");

/**
 * @desc Create a new transaction (transfer) for the authenticated user
 * @route POST /api/v1/transactions/create
 * @access Private
 */
async function createTransactionController(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    // 1. Validate request body presence
    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({ message: "fromAccount, toAccount, amount and idempotencyKey are required" });
    }

    if (amount <= 0 || !Number.isSafeInteger(amount)) {
        return res.status(400).json({ message: "Transaction amount must be a positive safe integer" });
    }

    // 2. Validate ObjectID formats
    if (!mongoose.Types.ObjectId.isValid(fromAccount) || !mongoose.Types.ObjectId.isValid(toAccount)) {
        return res.status(400).json({ message: "Invalid fromAccount or toAccount ID format" });
    }

    if (fromAccount.toString() === toAccount.toString()) {
        return res.status(400).json({ message: "Cannot transfer money to the same account" });
    }

    try {
        // Fetch source account to check ownership
        const sourceAccount = await AccountModel.findById(fromAccount);
        if (!sourceAccount) {
            return res.status(404).json({ message: "fromAccount not found" });
        }

        // Verify ownership (the logged-in user must own the fromAccount)
        if (sourceAccount.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You do not own this account" });
        }

        const result = await transactionService.transfer({
            fromAccountId: fromAccount,
            toAccountId: toAccount,
            amount,
            idempotencyKey,
            userEmail: req.user.email,
            userName: req.user.name
        });

        if (result.status === "Pending") {
            return res.status(200).json({
                message: "Transaction already exists and is pending"
            });
        }

        const statusCode = result.alreadyExists ? 200 : 201;
        const msg = result.alreadyExists
            ? "Transaction already exists and is completed"
            : "Transaction completed successfully";

        return res.status(statusCode).json({
            message: msg,
            transaction: result.transaction
        });

    } catch (error) {
        return res.status(400).json({
            message: "Transaction failed",
            error: error.message
        });
    }
}


/**
 * @desc Deposit money into user's account
 * @route POST /api/v1/transactions/deposit
 * @access Private
 */
async function depositController(req, res) {
    const { accountId, amount, idempotencyKey } = req.body;

    if (!accountId || !amount || !idempotencyKey) {
        return res.status(400).json({ message: "accountId, amount and idempotencyKey are required" });
    }

    if (amount <= 0 || !Number.isSafeInteger(amount)) {
        return res.status(400).json({ message: "Transaction amount must be a positive safe integer" });
    }

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({ message: "Invalid accountId ID format" });
    }

    try {
        // Validate user account ownership
        const userAccount = await AccountModel.findById(accountId);
        if (!userAccount) {
            return res.status(404).json({ message: "Account not found" });
        }

        if (userAccount.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You do not own this account" });
        }

        // Get system account
        const systemAccount = await transactionService.getSystemAccount();

        // Call transaction service
        const result = await transactionService.deposit({
            systemAccountId: systemAccount._id,
            userAccountId: accountId,
            amount,
            idempotencyKey,
            userEmail: req.user.email,
            userName: req.user.name
        });

        if (result.status === "Pending") {
            return res.status(200).json({
                message: "Transaction already exists and is pending"
            });
        }

        const statusCode = result.alreadyExists ? 200 : 201;
        const msg = result.alreadyExists
            ? "Transaction already exists and is completed"
            : "Deposit completed successfully";

        return res.status(statusCode).json({
            message: msg,
            transaction: result.transaction
        });

    } catch (error) {
        return res.status(400).json({
            message: "Deposit failed",
            error: error.message
        });
    }
}

/**
 * @desc Withdraw money from user's account
 * @route POST /api/v1/transactions/withdraw
 * @access Private
 */
async function withdrawController(req, res) {
    const { accountId, amount, idempotencyKey } = req.body;

    if (!accountId || !amount || !idempotencyKey) {
        return res.status(400).json({ message: "accountId, amount and idempotencyKey are required" });
    }

    if (amount <= 0 || !Number.isSafeInteger(amount)) {
        return res.status(400).json({ message: "Transaction amount must be a positive safe integer" });
    }

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({ message: "Invalid accountId ID format" });
    }

    try {
        // Validate user account ownership
        const userAccount = await AccountModel.findById(accountId);
        if (!userAccount) {
            return res.status(404).json({ message: "Account not found" });
        }

        if (userAccount.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You do not own this account" });
        }

        // Get system account
        const systemAccount = await transactionService.getSystemAccount();

        // Call transaction service
        const result = await transactionService.withdraw({
            userAccountId: accountId,
            systemAccountId: systemAccount._id,
            amount,
            idempotencyKey,
            userEmail: req.user.email,
            userName: req.user.name
        });

        if (result.status === "Pending") {
            return res.status(200).json({
                message: "Transaction already exists and is pending"
            });
        }

        const statusCode = result.alreadyExists ? 200 : 201;
        const msg = result.alreadyExists
            ? "Transaction already exists and is completed"
            : "Withdrawal completed successfully";

        return res.status(statusCode).json({
            message: msg,
            transaction: result.transaction
        });

    } catch (error) {
        return res.status(400).json({
            message: "Withdrawal failed",
            error: error.message
        });
    }
}

/**
 * @desc Get transaction history for authenticated user
 * @route GET /api/v1/transactions
 * @access Private
 */
async function getTransactionHistoryController(req, res) {
    const { accountId, type, page, limit, startDate, endDate } = req.query;

    // Parse options
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    if (pageNum <= 0 || limitNum <= 0) {
        return res.status(400).json({ message: "Page and limit must be positive integers" });
    }

    if (accountId && !mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({ message: "Invalid accountId ID format" });
    }

    // Validate type enum if provided
    if (type && !["Transfer", "Deposit", "Withdrawal", "Initial_Funding"].includes(type)) {
        return res.status(400).json({ message: "Invalid transaction type" });
    }

    try {
        const result = await transactionService.getTransactionHistory({
            userId: req.user._id,
            accountId,
            type,
            page: pageNum,
            limit: limitNum,
            startDate,
            endDate
        });

        return res.status(200).json({
            status: "success",
            data: result
        });

    } catch (error) {
        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            status: "fail",
            message: error.message
        });
    }
}

/**
 * @desc Get detailed information for a single transaction
 * @route GET /api/v1/transactions/:transactionId
 * @access Private
 */
async function getTransactionDetailsController(req, res) {
    const { transactionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
        return res.status(400).json({
            status: "fail",
            message: "Invalid transactionId ID format"
        });
    }

    try {
        const transaction = await transactionService.getTransactionDetails({
            userId: req.user._id,
            transactionId
        });

        return res.status(200).json({
            status: "success",
            data: transaction
        });

    } catch (error) {
        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            status: "fail",
            message: error.message
        });
    }
}

module.exports = {
    createTransactionController,
    depositController,
    withdrawController,
    getTransactionHistoryController,
    getTransactionDetailsController
};