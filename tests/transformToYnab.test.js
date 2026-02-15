const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  transformToYnab,
  normalizeDate,
  toMilliunits,
} = require("../src/transformToYnab");

describe("toMilliunits", () => {
  it("converts positive amount to negative milliunits (outflow)", () => {
    assert.equal(toMilliunits(100), -100000);
  });

  it("handles decimals", () => {
    assert.equal(toMilliunits(25.99), -25990);
  });

  it("handles zero", () => {
    assert.equal(toMilliunits(0), -0);
  });

  it("rounds to avoid floating point issues", () => {
    assert.equal(toMilliunits(19.99), -19990);
    assert.equal(toMilliunits(0.1), -100);
  });

  it("handles large amounts", () => {
    assert.equal(toMilliunits(50000), -50000000);
  });
});

describe("normalizeDate", () => {
  it("normalizes YYYY/MM/DD to YYYY-MM-DD", () => {
    assert.equal(normalizeDate("2025/01/15"), "2025-01-15");
  });

  it("normalizes YYYY-MM-DD (already correct)", () => {
    assert.equal(normalizeDate("2025-01-15"), "2025-01-15");
  });

  it("pads single-digit month and day", () => {
    assert.equal(normalizeDate("2025/1/5"), "2025-01-05");
  });

  it("normalizes MM/DD/YYYY", () => {
    assert.equal(normalizeDate("01/15/2025"), "2025-01-15");
  });

  it("falls back to emailDate when dateStr is empty", () => {
    assert.equal(normalizeDate("", "2025-06-15T10:00:00Z"), "2025-06-15");
  });

  it("falls back to emailDate when dateStr is null", () => {
    assert.equal(normalizeDate(null, "2025-06-15T10:00:00Z"), "2025-06-15");
  });

  it("returns today's date when both inputs are missing", () => {
    const today = new Date().toISOString().split("T")[0];
    assert.equal(normalizeDate(null, null), today);
  });

  it("handles ISO datetime as fallback", () => {
    assert.equal(
      normalizeDate(null, "2025-12-25T23:59:59.000Z"),
      "2025-12-25"
    );
  });
});

describe("transformToYnab", () => {
  const ACCOUNT_ID = "test-account-id-123";

  it("throws when accountId is missing", () => {
    assert.throws(() => transformToYnab([], ""), {
      message: "YNAB account_id is required",
    });
    assert.throws(() => transformToYnab([], null), {
      message: "YNAB account_id is required",
    });
  });

  it("returns empty array for empty input", () => {
    const result = transformToYnab([], ACCOUNT_ID);
    assert.deepEqual(result, []);
  });

  it("transforms a single transaction", () => {
    const input = [
      {
        transactionDate: "2025/01/15",
        emailDate: "2025-01-15T08:00:00Z",
        merchant: "星巴克 信義店",
        amount: 150,
        cardLast4: "4321",
      },
    ];

    const result = transformToYnab(input, ACCOUNT_ID);

    assert.equal(result.length, 1);
    assert.equal(result[0].account_id, ACCOUNT_ID);
    assert.equal(result[0].date, "2025-01-15");
    assert.equal(result[0].amount, -150000);
    assert.equal(result[0].payee_name, "星巴克 信義店");
    assert.equal(result[0].memo, "Card: ****4321");
    assert.equal(result[0].cleared, "cleared");
    assert.equal(result[0].import_id, "YNAB:-150000:2025-01-15:1");
  });

  it("handles multiple transactions", () => {
    const input = [
      {
        transactionDate: "2025/01/15",
        merchant: "Store A",
        amount: 100,
        cardLast4: "1234",
      },
      {
        transactionDate: "2025/01/15",
        merchant: "Store B",
        amount: 200,
        cardLast4: "1234",
      },
    ];

    const result = transformToYnab(input, ACCOUNT_ID);
    assert.equal(result.length, 2);
    assert.equal(result[0].payee_name, "Store A");
    assert.equal(result[1].payee_name, "Store B");
  });

  it("generates unique import_ids for same amount on same date", () => {
    const input = [
      {
        transactionDate: "2025/01/15",
        merchant: "7-ELEVEN Branch A",
        amount: 50,
        cardLast4: "1234",
      },
      {
        transactionDate: "2025/01/15",
        merchant: "7-ELEVEN Branch B",
        amount: 50,
        cardLast4: "1234",
      },
    ];

    const result = transformToYnab(input, ACCOUNT_ID);
    assert.equal(result[0].import_id, "YNAB:-50000:2025-01-15:1");
    assert.equal(result[1].import_id, "YNAB:-50000:2025-01-15:2");
  });

  it("sets empty memo when no card info", () => {
    const input = [
      {
        transactionDate: "2025/01/15",
        merchant: "Test",
        amount: 100,
        cardLast4: "",
      },
    ];

    const result = transformToYnab(input, ACCOUNT_ID);
    assert.equal(result[0].memo, "");
  });

  it("uses emailDate fallback when transactionDate is missing", () => {
    const input = [
      {
        transactionDate: null,
        emailDate: "2025-03-10T12:00:00Z",
        merchant: "Test Store",
        amount: 500,
        cardLast4: "9999",
      },
    ];

    const result = transformToYnab(input, ACCOUNT_ID);
    assert.equal(result[0].date, "2025-03-10");
  });

  it("handles decimal amounts correctly", () => {
    const input = [
      {
        transactionDate: "2025/01/15",
        merchant: "Foreign Store",
        amount: 29.99,
        cardLast4: "5678",
      },
    ];

    const result = transformToYnab(input, ACCOUNT_ID);
    assert.equal(result[0].amount, -29990);
  });
});
