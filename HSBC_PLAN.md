# Plan: HSBC Taiwan Bank Transaction Sync to YNAB

## Background

The existing codebase syncs **Cathay United Bank** (國泰世華銀行) transactions to YNAB by parsing a daily consolidated HTML summary email. This plan adds equivalent support for **HSBC Taiwan** (匯豐銀行台灣).

### Key Differences from Cathay

| Aspect | Cathay United Bank | HSBC Taiwan |
|--------|-------------------|-------------|
| Email type | Daily consolidated summary | Per-transaction alert |
| Email subject | `國泰世華銀行消費彙整通知` | `匯豐銀行信用卡交易警示` |
| Sender | `service@pxbillrc01.cathaybk.com.tw` | TBD (likely `*@hsbc.com.tw`) |
| Format | HTML table with class `spend_table` | Unknown — likely simple HTML or plain text |
| Transactions per email | Multiple (batched) | One (single transaction) |
| Notification threshold | All transactions | Domestic in-person >= NT$3,000; all online/overseas |

The biggest architectural difference is that HSBC sends **one email per transaction** (not a daily summary), so each email produces exactly one `ParsedTransaction` rather than an array.

### Unknown: Exact Email Format

The HSBC Taiwan notification email format is not publicly documented. The parser must be designed defensively to handle both:
- Simple HTML with inline transaction details (most likely)
- HTML table format (less likely but possible)
- Plain text fallback

We will need a real sample email from an HSBC Taiwan cardholder to finalize the parser. The plan below uses a best-guess structure that can be adapted once a real sample is obtained.

---

## Implementation Steps

### 1. Create `src/parseHsbcEmail.ts`

New parser module following the same pattern as `parseCathayEmail.ts`.

**Exported interface** — reuses the existing `ParsedTransaction` shape (same fields: `messageId`, `emailDate`, `transactionDate`, `merchant`, `amount`, `cardLast4`, `rawCells`).

**`parseHsbcEmail(html: unknown, emailDate: string, messageId: string): ParsedTransaction[]`**
- Returns `[]` for null/non-string input (same guard as Cathay parser)
- Always returns 0 or 1 transactions (since HSBC sends per-transaction emails)
- Extraction strategy (try in order):
  1. **HTML table extraction** — same regex approach as Cathay (`<table>` → `<tr>` → `<td>`) for robustness
  2. **Labeled field extraction** — scan for patterns like `交易金額.*?([\d,]+)`, `卡號末四碼.*?(\d{4})`, `特約商店.*?(.+)`, `交易日期.*?(\d{4}[/-]\d{1,2}[/-]\d{1,2})`
  3. **Fallback regex extraction** — look for any date pattern, any amount pattern, any 4-digit card number in the full HTML body

**Helper functions:**
- `extractHsbcFields(html: string): ExtractedFields` — the core extraction logic
- Reuse `stripHtml()` from `parseCathayEmail.ts` by extracting it to a shared `src/htmlUtils.ts` module

### 2. Create `src/htmlUtils.ts`

Extract the shared `stripHtml()` function from `parseCathayEmail.ts` into a common utility module. Both parsers will import from here.

- `stripHtml(str: string): string` — moved from `parseCathayEmail.ts`
- Re-export from `parseCathayEmail.ts` for backward compatibility

### 3. Update `src/parseCathayEmail.ts`

- Import `stripHtml` from `./htmlUtils.js` instead of defining it locally
- Re-export `stripHtml` so existing tests and consumers are unaffected

### 4. `src/transformToYnab.ts` — No Changes Needed

The transform module is already bank-agnostic. It accepts `ParsedTransaction[]` and converts to `YnabTransaction[]`. Both Cathay and HSBC parsers output the same `ParsedTransaction` shape, so `transformToYnab` works for both without modification.

### 5. Create `tests/parseHsbcEmail.test.ts`

Comprehensive tests mirroring the Cathay test structure:

- **Input guards**: null, undefined, empty string, non-string → returns `[]`
- **HTML table format**: transaction in a `<table>` (in case HSBC uses tables)
- **Labeled field format**: fields like `交易金額：NT$1,500` in `<div>` or `<p>` tags
- **Field extraction**: date formats (YYYY/MM/DD, YYYY-MM-DD), amounts with commas, card last 4, merchant name
- **Edge cases**: HTML entities in merchant names, nested tags, missing fields
- **Single transaction guarantee**: even malformed HTML never returns more than 1 transaction
- **emailDate fallback**: when transaction date is missing

### 6. Update `tests/parseCathayEmail.test.ts`

Update `stripHtml` import to come from `../src/htmlUtils.js` (or keep importing from `parseCathayEmail.ts` if it re-exports).

### 7. Create `workflows/hsbc-to-ynab.json`

New n8n workflow, modeled on `workflows/cathay-to-ynab.json`:

```
Schedule (every 6h)
    → Fetch HSBC Gmail Emails
    → Filter (Has HTML Body?)
    → Parse HSBC Email HTML
    → Filter (Valid Txns)
    → Transform to YNAB
    → POST to YNAB API
    → Mark Email as Read
```

**Differences from Cathay workflow:**
- Gmail filter: `from:*@hsbc.com.tw subject:匯豐銀行信用卡交易警示 is:unread`
  - Sender address TBD — use wildcard `@hsbc.com.tw` initially
- Parse node: uses `parseHsbcEmail` logic instead of `parseCathayEmail`
- Transform node: identical (same `transformToYnab` logic)
- YNAB POST node: may use same or different `YNAB_ACCOUNT_ID` depending on user setup

### 8. Update `README.md`

- Add HSBC Taiwan as a supported bank
- Document HSBC-specific email details (subject, sender, per-transaction format)
- Note the NT$3,000 domestic threshold limitation
- Add setup instructions for the HSBC workflow

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/htmlUtils.ts` | **Create** | Shared `stripHtml()` utility |
| `src/parseHsbcEmail.ts` | **Create** | HSBC email parser |
| `src/parseCathayEmail.ts` | **Modify** | Import `stripHtml` from `htmlUtils` |
| `src/transformToYnab.ts` | No change | Already bank-agnostic |
| `tests/parseHsbcEmail.test.ts` | **Create** | HSBC parser tests |
| `tests/parseCathayEmail.test.ts` | **Modify** | Update `stripHtml` import |
| `workflows/hsbc-to-ynab.json` | **Create** | n8n workflow for HSBC |
| `README.md` | **Modify** | Add HSBC documentation |

## Open Questions

1. **Exact email sender address** — Need to confirm the `From:` address for HSBC Taiwan transaction alerts (likely `*@hsbc.com.tw` or `*@email.hsbc.com.tw`)
2. **Exact email HTML structure** — Need a real sample email to finalize the parser. The initial implementation will be best-guess and should be validated against real data.
3. **YNAB account setup** — Should HSBC transactions go to the same YNAB account as Cathay, or a separate one? (This is a user configuration choice, not a code decision.)
