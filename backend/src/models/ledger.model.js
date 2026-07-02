const mongoose = require('mongoose');
const ledgerSchema = new mongoose.Schema({
    account:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: [true, "Ledger must belong to an account"],
        index: true,
        immutable: true
    },
    amount:{
        type: Number,
        required: [true, "Amount is required for ledger entry"],
        immutable: true,
        min:[1, "Ledger entry amount must be greater than 0"]
    },
    transaction:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        required: [true, "Ledger must be associated with a transaction"],
        index: true,
        immutable: true
    },
    type: {
        type: String,
        enum:{
            values: ["Credit", "Debit"],
            message: "Type must be either Credit or Debit"
        },
        required: [true, "Ledger type is required for ledger entry"],
        immutable: true
    }
},{
    timestamps: true
});

function preventLedgerModification(next) {
    next(new Error("Ledger entries are immutable and cannot be modified or deleted."));
}
ledgerSchema.pre("save", function () {
    if (!this.isNew) {
        throw new Error("Ledger entries are immutable.");
    }
});

ledgerSchema.pre("findOneAndUpdate", preventLedgerModification);
ledgerSchema.pre("updateOne", preventLedgerModification);
ledgerSchema.pre("updateMany", preventLedgerModification);
ledgerSchema.pre("replaceOne", preventLedgerModification);

ledgerSchema.pre("findOneAndDelete", preventLedgerModification);
ledgerSchema.pre("deleteOne", preventLedgerModification);
ledgerSchema.pre("deleteMany", preventLedgerModification);

// find all ledger entries for a particular account sorted by createdAt in descending order
ledgerSchema.index({
    account: 1,
    createdAt: -1
});

const ledgerModel = mongoose.model("Ledger", ledgerSchema);
module.exports = ledgerModel;