/**
 * Transform parsed Cathay bank transactions into YNAB API transaction format.
 *
 * YNAB uses milliunits: 1 TWD = 1000 milliunits.
 * Spending (outflows) are negative.
 *
 * @param {Array<Object>} parsedTransactions - Output from parseCathayEmail()
 * @param {string} accountId - YNAB account ID
 * @returns {Array<Object>} YNAB-formatted transactions
 */
function transformToYnab(parsedTransactions, accountId) {
  if (!accountId) {
    throw new Error("YNAB account_id is required");
  }

  const transactions = [];

  for (const tx of parsedTransactions) {
    const isoDate = normalizeDate(tx.transactionDate, tx.emailDate);
    const milliunits = toMilliunits(tx.amount);
    const memo = tx.cardLast4 ? `Card: ****${tx.cardLast4}` : "";

    // Generate import_id for deduplication
    const baseImportId = `YNAB:${milliunits}:${isoDate}`;
    const occurrence =
      transactions.filter(
        (t) => t.import_id && t.import_id.startsWith(baseImportId)
      ).length + 1;

    transactions.push({
      account_id: accountId,
      date: isoDate,
      amount: milliunits,
      payee_name: tx.merchant,
      memo,
      cleared: "cleared",
      import_id: `${baseImportId}:${occurrence}`,
    });
  }

  return transactions;
}

/**
 * Normalize a date string to ISO 8601 (YYYY-MM-DD).
 * Handles YYYY/MM/DD, YYYY-MM-DD, and MM/DD/YYYY formats.
 * Falls back to emailDate or today's date.
 *
 * @param {string} dateStr - Transaction date string
 * @param {string} fallbackDate - Fallback date (email received date)
 * @returns {string} ISO 8601 date string (YYYY-MM-DD)
 */
function normalizeDate(dateStr, fallbackDate) {
  if (!dateStr && !fallbackDate) {
    return new Date().toISOString().split("T")[0];
  }

  const str = dateStr || "";

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = str.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, "0")}-${ymdMatch[3].padStart(2, "0")}`;
  }

  // MM/DD/YYYY
  const mdyMatch = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
  }

  // Fallback to email date
  if (fallbackDate) {
    const d = new Date(fallbackDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Convert a TWD amount to YNAB milliunits.
 * Spending amounts become negative (outflows).
 *
 * @param {number} amount - The TWD amount (positive = spending)
 * @returns {number} Milliunits (negative for outflows)
 */
function toMilliunits(amount) {
  return Math.round(amount * -1000);
}

module.exports = { transformToYnab, normalizeDate, toMilliunits };
