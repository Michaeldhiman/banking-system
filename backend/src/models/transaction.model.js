const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
    fromAccount:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: [true,"transaction must have a from account"],
        index: true
    },
    toAccount:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: [true,"transaction must have a to account"],
        index: true
    },
    status:{
        type: String,
        enum: {
            values: ["Pending", "Completed", "Failed","Reversed"],
            message: "Status must be either Pending, Completed , Failed or Reversed"
        },
        default: "Pending",
    },
    amount:{
        type: Number,
        required: [true,"transaction must have an amount"],
        min: [1, "Transaction amount must be greater than 0"]
    },
    type: {
        type: String,
        enum: {
            values: ["Transfer", "Deposit", "Withdrawal", "Initial_Funding"],
            message: "Type must be either Transfer, Deposit, Withdrawal or Initial_Funding"
        },
        required: [true, "Transaction must have a type"],
        default: "Transfer"
    },
    idempotencyKey: {
        type: String,
        required: [true, "Transaction must have an idempotency key"],
        unique: true,
        sparse: true,
        index: true,
    }
},{
    timestamps: true
});

const transactionModel = mongoose.model("Transaction", transactionSchema);
module.exports = transactionModel;