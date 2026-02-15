/**
 * Parse Cathay United Bank (國泰世華銀行) spending summary email HTML.
 * Extracts individual transactions from the consolidated daily email.
 *
 * Cathay sends a daily email "國泰世華銀行消費彙整通知" containing an HTML table
 * with class "spend_table" that lists all credit/debit card transactions.
 *
 * @param {string} html - The raw HTML body of the email
 * @param {string} emailDate - The date the email was received (fallback for transaction date)
 * @param {string} messageId - The Gmail message ID (for tracking)
 * @returns {Array<Object>} Parsed transactions
 */
function parseCathayEmail(html, emailDate, messageId) {
  if (!html || typeof html !== "string") {
    return [];
  }

  const transactions = [];

  const tableRegex = /class=["']spend_table["'][^>]*>(.*?)<\/table>/gis;
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;

  let tables = [...html.matchAll(tableRegex)];

  if (tables.length === 0) {
    // Fallback: try generic tables (Cathay may use inline styles instead of classes)
    const altTableRegex = /<table[^>]*>(.*?)<\/table>/gis;
    tables = [...html.matchAll(altTableRegex)];
  }

  for (const table of tables) {
    const tableHtml = table[1] || table[0];
    const rows = [...tableHtml.matchAll(rowRegex)];

    for (const row of rows) {
      const rowHtml = row[1] || row[0];
      const cells = [...rowHtml.matchAll(cellRegex)];
      const cellValues = cells.map((c) => stripHtml(c[1] || ""));

      // Skip header rows and empty rows
      if (cellValues.length < 3) continue;
      if (cellValues.some((v) => /日期|時間|交易|Date/i.test(v))) continue;

      const parsed = extractTransactionFields(cellValues);

      if (parsed.amount !== null && (parsed.merchant || parsed.txDate)) {
        transactions.push({
          messageId,
          emailDate,
          transactionDate: parsed.txDate || emailDate,
          merchant: parsed.merchant || "Unknown",
          amount: parsed.amount,
          cardLast4: parsed.cardLast4 || "",
          rawCells: cellValues,
        });
      }
    }
  }

  return transactions;
}

/**
 * Strip HTML tags and decode common HTML entities.
 * @param {string} str - HTML string
 * @returns {string} Plain text
 */
function stripHtml(str) {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .trim();
}

/**
 * Extract transaction fields (date, merchant, amount, card) from an array of cell values.
 * @param {Array<string>} cellValues - Array of plain-text cell values from a table row
 * @returns {Object} Extracted fields: { txDate, merchant, amount, cardLast4 }
 */
function extractTransactionFields(cellValues) {
  let txDate = null;
  let merchant = null;
  let amount = null;
  let cardLast4 = null;

  for (const val of cellValues) {
    // Date pattern: YYYY/MM/DD or MM/DD or YYYY-MM-DD
    if (!txDate && /\d{2,4}[/-]\d{1,2}[/-]\d{1,2}/.test(val)) {
      txDate = val;
    }
    // Amount pattern: numbers with optional comma/decimal, possibly with NT$ or TWD
    else if (
      !amount &&
      /[\d,]+\.?\d*/.test(val) &&
      /\d{2,}/.test(val.replace(/,/g, ""))
    ) {
      amount = parseFloat(val.replace(/[^\d.\-]/g, ""));
    }
    // Card last 4 digits
    else if (!cardLast4 && /^\d{4}$/.test(val.trim())) {
      cardLast4 = val.trim();
    }
    // Merchant name: whatever's left that isn't a number or date
    else if (!merchant && val.length > 1 && !/^[\d\s.,/\-]+$/.test(val)) {
      merchant = val;
    }
  }

  return { txDate, merchant, amount, cardLast4 };
}

module.exports = { parseCathayEmail, stripHtml, extractTransactionFields };
