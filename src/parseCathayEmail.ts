import { stripHtml } from "./htmlUtils.js";

export { stripHtml };

export interface ParsedTransaction {
  messageId: string;
  emailDate: string;
  transactionDate: string;
  merchant: string;
  amount: number;
  cardLast4: string;
  rawCells: string[];
}

export interface ExtractedFields {
  txDate: string | null;
  merchant: string | null;
  amount: number | null;
  cardLast4: string | null;
}

/**
 * Parse Cathay United Bank (國泰世華銀行) spending summary email HTML.
 * Extracts individual transactions from the consolidated daily email.
 *
 * Cathay sends a daily email "國泰世華銀行消費彙整通知" containing an HTML table
 * with class "spend_table" that lists all credit/debit card transactions.
 */
export function parseCathayEmail(
  html: unknown,
  emailDate: string,
  messageId: string,
): ParsedTransaction[] {
  if (!html || typeof html !== "string") {
    return [];
  }

  const transactions: ParsedTransaction[] = [];

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
    const tableHtml: string = table[1] ?? table[0];
    const rows = [...tableHtml.matchAll(rowRegex)];

    for (const row of rows) {
      const rowHtml: string = row[1] ?? row[0];
      const cells = [...rowHtml.matchAll(cellRegex)];
      const cellValues: string[] = cells.map((c) => stripHtml(c[1] ?? ""));

      // Skip header rows and empty rows
      if (cellValues.length < 3) continue;
      if (cellValues.some((v) => /日期|時間|交易|Date/i.test(v))) continue;

      const parsed = extractTransactionFields(cellValues);

      if (parsed.amount !== null && (parsed.merchant !== null || parsed.txDate !== null)) {
        transactions.push({
          messageId,
          emailDate,
          transactionDate: parsed.txDate ?? emailDate,
          merchant: parsed.merchant ?? "Unknown",
          amount: parsed.amount,
          cardLast4: parsed.cardLast4 ?? "",
          rawCells: cellValues,
        });
      }
    }
  }

  return transactions;
}

/**
 * Extract transaction fields (date, merchant, amount, card) from an array of cell values.
 */
export function extractTransactionFields(cellValues: string[]): ExtractedFields {
  let txDate: string | null = null;
  let merchant: string | null = null;
  let amount: number | null = null;
  let cardLast4: string | null = null;

  for (const val of cellValues) {
    // Date pattern: YYYY/MM/DD or MM/DD or YYYY-MM-DD
    if (txDate === null && /\d{2,4}[/-]\d{1,2}[/-]\d{1,2}/.test(val)) {
      txDate = val;
    }
    // Amount pattern: numbers with optional comma/decimal, possibly with NT$ or TWD
    else if (
      amount === null &&
      /[\d,]+\.?\d*/.test(val) &&
      /\d{2,}/.test(val.replace(/,/g, ""))
    ) {
      amount = parseFloat(val.replace(/[^\d.\-]/g, ""));
    }
    // Card last 4 digits
    else if (cardLast4 === null && /^\d{4}$/.test(val.trim())) {
      cardLast4 = val.trim();
    }
    // Merchant name: whatever's left that isn't a number or date
    else if (merchant === null && val.length > 1 && !/^[\d\s.,/\-]+$/.test(val)) {
      merchant = val;
    }
  }

  return { txDate, merchant, amount, cardLast4 };
}
