/**
 * Currency and Minor Unit Utilities for Banking / FinTech Operations
 */

/**
 * Convert integer minor units (paise/cents) to standard decimal units (INR/USD)
 * @param {number} minorUnits - Integer amount in minor units (e.g., 1050)
 * @returns {number} Standard unit decimal (e.g., 10.50)
 */
function toStandardUnits(minorUnits) {
    if (typeof minorUnits !== "number" || isNaN(minorUnits)) {
        return 0;
    }
    return Number((minorUnits / 100).toFixed(2));
}

/**
 * Format integer minor units into a localized currency string
 * @param {number} minorUnits - Integer amount in minor units (e.g., 100000)
 * @param {string} [currency="INR"] - 3-letter currency code (e.g., "INR", "USD", "EUR")
 * @returns {string} Formatted string (e.g., "₹1,000.00" or "$1,000.00")
 */
function formatCurrency(minorUnits, currency = "INR") {
    const standardAmount = toStandardUnits(minorUnits);
    const curr = (currency || "INR").toUpperCase();

    try {
        const localeMap = {
            INR: "en-IN",
            USD: "en-US",
            EUR: "en-DE",
            GBP: "en-GB"
        };
        const locale = localeMap[curr] || "en-US";

        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: curr,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(standardAmount);
    } catch (err) {
        // Safe fallback
        return `${curr} ${standardAmount.toFixed(2)}`;
    }
}

/**
 * Enrich a transaction document or plain object with minor and standard units
 * @param {Object} tx - Transaction document / object
 * @returns {Object} Formatted transaction object
 */
function formatTransaction(tx) {
    if (!tx) return tx;
    const obj = typeof tx.toObject === "function" ? tx.toObject() : { ...tx };
    const currency = obj.fromAccount?.currency || obj.toAccount?.currency || "INR";
    obj.amountMinor = obj.amount;
    obj.amountStandard = toStandardUnits(obj.amount);
    obj.formattedAmount = formatCurrency(obj.amount, currency);
    return obj;
}

module.exports = {
    toStandardUnits,
    formatCurrency,
    formatTransaction
};
