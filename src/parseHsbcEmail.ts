export interface ParsedTransaction {
  messageId: string;
  emailDate: string;
  transactionDate: string;
  merchant: string;
  amount: number;
  cardLast4: string;
  rawCells: string[];
}

/**
 * Parse HSBC Taiwan (匯豐銀行台灣) credit card transaction alert email HTML.
 *
 * HSBC sends a per-transaction alert email "匯豐銀行信用卡交易警示" from
 * enotification@mail.hsbc.com.tw. Each email contains exactly one transaction.
 *
 * NOTE: The parsing logic is a placeholder — it will be finalized once a real
 * sample email is provided. For now, this returns an empty array.
 */
export function parseHsbcEmail(
  html: unknown,
  emailDate: string,
  messageId: string,
): ParsedTransaction[] {
  if (!html || typeof html !== "string") {
    return [];
  }

  // TODO: Implement parsing once a real HSBC email sample is available.
  // Extraction strategy (try in order):
  //   1. HTML table extraction — <table> → <tr> → <td>
  //   2. Labeled field extraction — patterns like 交易金額.*?([\d,]+)
  //   3. Fallback regex extraction — date, amount, 4-digit card in full body
  //
  // Each email contains exactly one transaction, so this will return 0 or 1 items.

  return [];
}
