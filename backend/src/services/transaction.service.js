const mongoose = require("mongoose");
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const AccountModel = require("../models/account.model");
const { sendTransactionEmail, sendTransactionEmailFailed } = require("./email.service");
const { formatTransaction } = require("../utils/currency.utils");

/**
 * Resolves the single System Account dynamically.
 */
async function getSystemAccount() {
    const User = require("../models/user.model");
    const systemUser = await User.findOne({ systemUser: true });
    if (!systemUser) {
        throw new Error("System user not found");
    }
    const systemAccount = await AccountModel.findOne({ user: systemUser._id });
    if (!systemAccount) {
        throw new Error("System account not found");
    }
    return systemAccount;
}

/**
 * Executes a double-entry transaction (Deposit, Withdrawal, Transfer, Initial_Funding) inside a MongoDB session.
 * 
 * @param {Object} params
 * @param {string} params.fromAccountId - ID of source account
 * @param {string} params.toAccountId - ID of destination account
 * @param {number} params.amount - Amount in minor units (integer)
 * @param {string} params.idempotencyKey - Idempotency key to prevent double processing
 * @param {string} params.type - Enum: "Transfer" | "Deposit" | "Withdrawal" | "Initial_Funding"
 * @param {boolean} [params.validateBalance=false] - Whether to validate sufficient balance on fromAccount
 * @param {string} [params.userEmail] - Optional user email for notifications
 * @param {string} [params.userName] - Optional user name for notifications
 * @returns {Promise<Object>} The status and the transaction document
 */
async function executeDoubleEntry({
    fromAccountId,
    toAccountId,
    amount,
    idempotencyKey,
    type,
    validateBalance = false,
    userEmail = null,
    userName = "Customer"
}) {
    // 1. Validate inputs basic checking
    if (!fromAccountId || !toAccountId || !amount || !idempotencyKey || !type) {
        throw new Error("fromAccountId, toAccountId, amount, idempotencyKey, and type are required");
    }

    if (amount <= 0 || !Number.isSafeInteger(amount)) {
        throw new Error("Transaction amount must be a positive safe integer (representing minor units)");
    }

    // 2. Validate idempotency key (Read Path check)
    const existingTransaction = await transactionModel.findOne({ idempotencyKey });
    if (existingTransaction) {
        if (existingTransaction.status === "Completed") {
            return {
                alreadyExists: true,
                status: "Completed",
                transaction: existingTransaction
            };
        }
        if (existingTransaction.status === "Pending") {
            return {
                alreadyExists: true,
                status: "Pending"
            };
        }
        if (existingTransaction.status === "Failed") {
            throw new Error("Transaction already exists and has failed, please try again with a new idempotency key");
        }
        if (existingTransaction.status === "Reversed") {
            throw new Error("Transaction already exists and has been reversed, please try again with a new idempotency key");
        }
    }

    // 3. Claim the idempotency key by creating a Pending transaction outside the session
    let transactionDoc;
    try {
        transactionDoc = await transactionModel.create({
            fromAccount: fromAccountId,
            toAccount: toAccountId,
            amount,
            type,
            idempotencyKey,
            status: "Pending"
        });
    } catch (error) {
        // Handle race condition where a concurrent request created the document first
        if (error?.code === 11000) {
            const retryTx = await transactionModel.findOne({ idempotencyKey });
            return {
                alreadyExists: true,
                status: retryTx?.status,
                transaction: retryTx
            };
        }
        throw error;
    }

    // 4. Start MongoDB session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Fetch accounts inside the transaction to guarantee consistency
        const [fromAccount, toAccount] = await Promise.all([
            AccountModel.findById(fromAccountId).session(session),
            AccountModel.findById(toAccountId).session(session)
        ]);

        if (!fromAccount) {
            throw new Error("Source account not found");
        }
        if (!toAccount) {
            throw new Error("Destination account not found");
        }

        // Validate account statuses
        if (fromAccount.status !== "Active" || toAccount.status !== "Active") {
            throw new Error("One or both accounts are not active");
        }

        // Verify currency consistency
        if (fromAccount.currency !== toAccount.currency) {
            throw new Error(`Currency mismatch: Source currency (${fromAccount.currency}) does not match destination currency (${toAccount.currency})`);
        }

        // 5. Balance Validation (if enabled)
        if (validateBalance) {
            const balance = await fromAccount.getBalance(session);
            if (balance < amount) {
                throw new Error(`Insufficient balance in source account, available: ${balance}, required: ${amount}`);
            }
        }

        // 6. Create DEBIT ledger entry for source account
        await ledgerModel.create([{
            account: fromAccountId,
            amount,
            transaction: transactionDoc._id,
            type: "Debit"
        }], { session });

        // 7. Create CREDIT ledger entry for destination account
        await ledgerModel.create([{
            account: toAccountId,
            amount,
            transaction: transactionDoc._id,
            type: "Credit"
        }], { session });

        // 8. Update transaction status to completed inside session
        await transactionModel.updateOne(
            { _id: transactionDoc._id },
            { $set: { status: "Completed" } },
            { session }
        );

        // 9. Commit MongoDB session
        await session.commitTransaction();
        session.endSession();

        transactionDoc.status = "Completed";

        // Send success email notification asynchronously if email is provided
        if (userEmail && (type === "Transfer" || type === "Withdrawal" || type === "Deposit")) {
            sendTransactionEmail(userEmail, userName, {
                amount,
                receiver: toAccountId,
                transactionId: transactionDoc._id
            }).catch(emailError => console.error("Error sending transaction email:", emailError));
        }

        return {
            alreadyExists: false,
            status: "Completed",
            transaction: transactionDoc
        };

    } catch (innerError) {
        // Abort the session to roll back all ledger entries
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();

        // Mark transaction as failed outside the session for audit trail integrity
        transactionDoc.status = "Failed";
        await transactionDoc.save();

        // Send email notification for failed transaction asynchronously if email is provided
        if (userEmail && (type === "Transfer" || type === "Withdrawal" || type === "Deposit")) {
            sendTransactionEmailFailed(userEmail, userName, {
                amount,
                receiver: toAccountId,
                transactionId: transactionDoc._id
            }).catch(emailError => console.error("Error sending transaction failed email:", emailError));
        }

        throw innerError;
    }
}

/**
 * Service to transfer money between two users.
 */
async function transfer({ fromAccountId, toAccountId, amount, idempotencyKey, userEmail, userName }) {
    return executeDoubleEntry({
        fromAccountId,
        toAccountId,
        amount,
        idempotencyKey,
        type: "Transfer",
        validateBalance: true,
        userEmail,
        userName
    });
}

/**
 * Service to deposit money into a user's account.
 */
async function deposit({ systemAccountId, userAccountId, amount, idempotencyKey, userEmail, userName, isInitialFunding = false }) {
    return executeDoubleEntry({
        fromAccountId: systemAccountId,
        toAccountId: userAccountId,
        amount,
        idempotencyKey,
        type: isInitialFunding ? "Initial_Funding" : "Deposit",
        validateBalance: false, // System account has infinite funds
        userEmail,
        userName
    });
}

/**
 * Service to withdraw money from a user's account.
 */
async function withdraw({ userAccountId, systemAccountId, amount, idempotencyKey, userEmail, userName }) {
    return executeDoubleEntry({
        fromAccountId: userAccountId,
        toAccountId: systemAccountId,
        amount,
        idempotencyKey,
        type: "Withdrawal",
        validateBalance: true, // User must have enough money to withdraw
        userEmail,
        userName
    });
}

/**
 * Service to fetch paginated transaction history for a user or specific account.
 */
async function getTransactionHistory({ userId, accountId, type, page = 1, limit = 10, startDate, endDate }) {
    // 1. Get all active accounts for the user
    const userAccounts = await AccountModel.find({ user: userId });
    const userAccountIds = userAccounts.map(acc => acc._id.toString());

    let accountsToFilter = [];

    // 2. Validate ownership if a specific account is requested
    if (accountId) {
        if (!userAccountIds.includes(accountId)) {
            const err = new Error("Forbidden access, you do not own the requested account");
            err.statusCode = 403;
            throw err;
        }
        accountsToFilter = [new mongoose.Types.ObjectId(accountId)];
    } else {
        accountsToFilter = userAccounts.map(acc => acc._id);
    }

    // 3. Build query
    const query = {
        $or: [
            { fromAccount: { $in: accountsToFilter } },
            { toAccount: { $in: accountsToFilter } }
        ]
    };

    if (type) {
        query.type = type;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // 4. Execute queries
    const totalDocs = await transactionModel.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);
    const offset = (page - 1) * limit;

    const transactions = await transactionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("fromAccount", "_id currency status")
        .populate("toAccount", "_id currency status");

    const formattedTransactions = transactions.map(tx => formatTransaction(tx));

    return {
        transactions: formattedTransactions,
        pagination: {
            totalDocs,
            limit,
            page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

/**
 * Service to fetch a single transaction's details with authorization check.
 */
async function getTransactionDetails({ userId, transactionId }) {
    // 1. Fetch transaction and populate accounts
    const transaction = await transactionModel.findById(transactionId)
        .populate("fromAccount", "_id user currency status")
        .populate("toAccount", "_id user currency status");

    if (!transaction) {
        const err = new Error("Transaction not found");
        err.statusCode = 404;
        throw err;
    }

    // 2. Resolve user's accounts to verify authorization
    const userAccounts = await AccountModel.find({ user: userId });
    const userAccountIds = userAccounts.map(acc => acc._id.toString());

    const fromAccId = transaction.fromAccount?._id?.toString();
    const toAccId = transaction.toAccount?._id?.toString();

    // User must own either the fromAccount or toAccount to view it
    if (!userAccountIds.includes(fromAccId) && !userAccountIds.includes(toAccId)) {
        const err = new Error("Forbidden access, you are not authorized to view this transaction");
        err.statusCode = 403;
        throw err;
    }

    return formatTransaction(transaction);
}

module.exports = {
    executeDoubleEntry,
    transfer,
    deposit,
    withdraw,
    getTransactionHistory,
    getTransactionDetails,
    getSystemAccount
};
