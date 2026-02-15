import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseHsbcEmail } from "../src/parseHsbcEmail.js";

describe("parseHsbcEmail", () => {
  it("returns empty array for null input", () => {
    assert.deepEqual(parseHsbcEmail(null, "2025-01-01", "msg1"), []);
  });

  it("returns empty array for undefined input", () => {
    assert.deepEqual(parseHsbcEmail(undefined, "2025-01-01", "msg1"), []);
  });

  it("returns empty array for empty string input", () => {
    assert.deepEqual(parseHsbcEmail("", "2025-01-01", "msg1"), []);
  });

  it("returns empty array for non-string input", () => {
    assert.deepEqual(parseHsbcEmail(123, "2025-01-01", "msg1"), []);
    assert.deepEqual(parseHsbcEmail({}, "2025-01-01", "msg1"), []);
  });

  // TODO: Add parsing tests once a real HSBC email sample is available
  // Expected tests:
  //   - parses single transaction from HTML table format
  //   - parses single transaction from labeled field format
  //   - extracts date, merchant, amount, cardLast4
  //   - handles HTML entities in merchant names
  //   - uses emailDate as fallback when transaction date is missing
  //   - never returns more than 1 transaction per email
});
