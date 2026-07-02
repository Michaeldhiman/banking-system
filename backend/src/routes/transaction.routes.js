const express = require('express');
const {authMiddleware} = require('../middlewares/auth.middleware');
const { createTransactionController, depositController, withdrawController, getTransactionHistoryController, getTransactionDetailsController} = require('../controllers/transaction.controller');

const router = express.Router();


/**
 * GET /api/v1/transactions
 * - get transaction history / statement for authenticated user
 */
router.get("/",authMiddleware,getTransactionHistoryController);

/**
 * GET /api/v1/transactions/:transactionId
 * - get detailed info for a single transaction
 */
router.get("/:transactionId",authMiddleware,getTransactionDetailsController);

/**
 * -POST  /api/v1/transactions/create 
 * - create a new transaction
 */ 

router.post("/create",authMiddleware,createTransactionController);

/**
 * POST /api/v1/transactions/deposit
 * - deposit money into user's account
 */
router.post("/deposit",authMiddleware,depositController);

/**
 * POST /api/v1/transactions/withdraw
 * - withdraw money from user's account
 */
router.post("/withdraw",authMiddleware,withdrawController);

module.exports = router;