const express = require("express");
const { authMiddleware } = require("../middlewares/auth.middleware");
const {
    createAccountController,
    getAllAccountsController,
    getAccountDetailsController,
    updateAccountStatusController
} = require("../controllers/account.controller");

const router = express.Router();

// POST /api/v1/accounts
// - Create a new bank account for the authenticated user
router.post("/", authMiddleware, createAccountController);

// GET /api/v1/accounts
// - Get all active accounts for the authenticated user
router.get("/", authMiddleware, getAllAccountsController);

// GET /api/v1/accounts/:accountId
// - Get complete account details (metadata + dynamic ledger balance)
router.get("/:accountId", authMiddleware, getAccountDetailsController);

// PATCH /api/v1/accounts/:accountId
// - Freeze / Unfreeze or Close account status
router.patch("/:accountId", authMiddleware, updateAccountStatusController);

module.exports = router;