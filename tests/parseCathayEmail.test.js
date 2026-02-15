const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseCathayEmail,
  stripHtml,
  extractTransactionFields,
} = require("../src/parseCathayEmail");

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    assert.equal(stripHtml("<b>hello</b>"), "hello");
  });

  it("decodes &nbsp;", () => {
    assert.equal(stripHtml("hello&nbsp;world"), "hello world");
  });

  it("decodes &amp;", () => {
    assert.equal(stripHtml("A&amp;B"), "A&B");
  });

  it("decodes &lt; and &gt;", () => {
    assert.equal(stripHtml("&lt;div&gt;"), "<div>");
  });

  it("strips numeric character references", () => {
    assert.equal(stripHtml("hello&#8203;world"), "helloworld");
  });

  it("trims whitespace", () => {
    assert.equal(stripHtml("  hello  "), "hello");
  });

  it("handles nested tags", () => {
    assert.equal(stripHtml("<a href='#'><b>link</b></a>"), "link");
  });

  it("returns empty string for empty input", () => {
    assert.equal(stripHtml(""), "");
  });
});

describe("extractTransactionFields", () => {
  it("extracts date, merchant, amount, and card from typical cells", () => {
    const cells = ["2025/01/15", "星巴克 信義店", "150", "4321"];
    const result = extractTransactionFields(cells);
    assert.equal(result.txDate, "2025/01/15");
    assert.equal(result.merchant, "星巴克 信義店");
    assert.equal(result.amount, 150);
    assert.equal(result.cardLast4, "4321");
  });

  it("handles amount with comma separators", () => {
    const cells = ["2025/02/10", "全聯福利中心", "1,234"];
    const result = extractTransactionFields(cells);
    assert.equal(result.amount, 1234);
    assert.equal(result.merchant, "全聯福利中心");
  });

  it("handles amount with decimal", () => {
    const cells = ["2025/03/01", "AMAZON", "99.50"];
    const result = extractTransactionFields(cells);
    assert.equal(result.amount, 99.5);
  });

  it("handles YYYY-MM-DD date format", () => {
    const cells = ["2025-01-15", "Uber Eats", "350"];
    const result = extractTransactionFields(cells);
    assert.equal(result.txDate, "2025-01-15");
  });

  it("returns null amount when no valid amount found", () => {
    const cells = ["hello", "world"];
    const result = extractTransactionFields(cells);
    assert.equal(result.amount, null);
  });

  it("does not confuse card last 4 digits with amount", () => {
    const cells = ["2025/01/15", "COSTCO", "2,500", "7890"];
    const result = extractTransactionFields(cells);
    assert.equal(result.amount, 2500);
    assert.equal(result.cardLast4, "7890");
  });
});

describe("parseCathayEmail", () => {
  it("returns empty array for null/undefined input", () => {
    assert.deepEqual(parseCathayEmail(null, "2025-01-01", "msg1"), []);
    assert.deepEqual(parseCathayEmail(undefined, "2025-01-01", "msg1"), []);
    assert.deepEqual(parseCathayEmail("", "2025-01-01", "msg1"), []);
  });

  it("returns empty array for non-string input", () => {
    assert.deepEqual(parseCathayEmail(123, "2025-01-01", "msg1"), []);
  });

  it("parses transactions from spend_table class", () => {
    const html = `
      <html><body>
        <table class="spend_table">
          <tr><td>日期</td><td>商店</td><td>金額</td><td>卡號末四碼</td></tr>
          <tr><td>2025/01/15</td><td>星巴克 信義店</td><td>150</td><td>4321</td></tr>
          <tr><td>2025/01/15</td><td>全家便利商店</td><td>75</td><td>4321</td></tr>
        </table>
      </body></html>
    `;

    const result = parseCathayEmail(html, "2025-01-15T08:00:00Z", "msg123");

    assert.equal(result.length, 2);

    assert.equal(result[0].transactionDate, "2025/01/15");
    assert.equal(result[0].merchant, "星巴克 信義店");
    assert.equal(result[0].amount, 150);
    assert.equal(result[0].cardLast4, "4321");
    assert.equal(result[0].messageId, "msg123");

    assert.equal(result[1].merchant, "全家便利商店");
    assert.equal(result[1].amount, 75);
  });

  it("skips header rows containing 日期 or 交易", () => {
    const html = `
      <table class="spend_table">
        <tr><td>交易日期</td><td>交易商店</td><td>交易金額</td></tr>
        <tr><td>2025/01/20</td><td>7-ELEVEN</td><td>35</td></tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-01-20", "msg2");
    assert.equal(result.length, 1);
    assert.equal(result[0].merchant, "7-ELEVEN");
  });

  it("falls back to generic tables when no spend_table class", () => {
    const html = `
      <table>
        <tr><td>2025/02/01</td><td>IKEA</td><td>3,500</td></tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-02-01", "msg3");
    assert.equal(result.length, 1);
    assert.equal(result[0].merchant, "IKEA");
    assert.equal(result[0].amount, 3500);
  });

  it("uses emailDate as fallback when transaction has no date", () => {
    const html = `
      <table class="spend_table">
        <tr><td>家樂福</td><td>899</td><td>1234</td></tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-03-10", "msg4");
    assert.equal(result.length, 1);
    assert.equal(result[0].transactionDate, "2025-03-10");
    assert.equal(result[0].merchant, "家樂福");
  });

  it("handles HTML entities inside cells", () => {
    const html = `
      <table class="spend_table">
        <tr><td>2025/01/15</td><td>H&amp;M</td><td>1,200</td></tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-01-15", "msg5");
    assert.equal(result.length, 1);
    assert.equal(result[0].merchant, "H&M");
  });

  it("handles nested HTML tags inside cells", () => {
    const html = `
      <table class="spend_table">
        <tr>
          <td><span style="color:black">2025/04/01</span></td>
          <td><b>UNIQLO</b></td>
          <td><span>590</span></td>
          <td>5678</td>
        </tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-04-01", "msg6");
    assert.equal(result.length, 1);
    assert.equal(result[0].merchant, "UNIQLO");
    assert.equal(result[0].amount, 590);
    assert.equal(result[0].cardLast4, "5678");
  });

  it("skips rows with fewer than 3 cells", () => {
    const html = `
      <table class="spend_table">
        <tr><td>only one cell</td></tr>
        <tr><td>two</td><td>cells</td></tr>
        <tr><td>2025/01/15</td><td>OK Mart</td><td>50</td></tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-01-15", "msg7");
    assert.equal(result.length, 1);
    assert.equal(result[0].merchant, "OK Mart");
  });

  it("parses multiple tables in one email", () => {
    const html = `
      <table class="spend_table">
        <tr><td>2025/01/10</td><td>Store A</td><td>100</td></tr>
      </table>
      <table class="spend_table">
        <tr><td>2025/01/10</td><td>Store B</td><td>200</td></tr>
      </table>
    `;

    const result = parseCathayEmail(html, "2025-01-10", "msg8");
    assert.equal(result.length, 2);
    assert.equal(result[0].merchant, "Store A");
    assert.equal(result[1].merchant, "Store B");
  });
});
