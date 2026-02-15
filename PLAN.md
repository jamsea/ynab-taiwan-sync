# Cathay Taiwan Bank → YNAB Transaction Sync — Project Plan

## Research Findings

### YNAB API
- **Base URL**: `https://api.youneedabudget.com/v1`
- **Auth**: Personal Access Tokens (generated at app.ynab.com → Account Settings → Developer Settings)
- **Key endpoint**: `POST /v1/budgets/{budget_id}/transactions` for creating transactions
- **Amounts**: Uses "milliunits" (1 TWD = 1000 milliunits, so 294.23 TWD = 294230)
- **Deduplication**: Built-in via `import_id` field (format: `YNAB:[milliunit_amount]:[iso_date]:[occurrence]`)
- **Rate limit**: 200 requests per 60 minutes
- **Batch support**: Can create multiple transactions in a single POST call

### Cathay United Bank (國泰世華銀行) API Access

**There is no publicly accessible API for individual developers.**

Taiwan has a 3-phase Open Banking initiative managed by FISC:
- **Phase 1** (live 2019): Public product data only (rates, ATM locations) — Cathay participates
- **Phase 2** (live 2020): Customer data query — Cathay participates, but only through TDCC ePassbook app (requires Cathay Securities account, limited to settlement account)
- **Phase 3** (live Jan 2024): Transactions — Cathay is **NOT yet live** (only 4 pioneer banks: First Bank, Hua Nan, E.SUN, CTBC)

Cathay also has a **CaaS (Cathay as a Service) B2B platform** at `caas.cathayholdings.com`, but it requires a formal business partnership agreement — not viable for a personal/open-source project.

**No Plaid equivalent exists in Taiwan.** International aggregators (Plaid, Tink, Salt Edge) do not cover Taiwan.

---

## Three Potential Solutions

### Solution 1: Email Parsing (Recommended)
**Parse Cathay's daily consolidated spending summary emails**

Cathay sends a daily HTML email called "國泰世華銀行消費彙整通知" from `service@pxbillrc01.cathaybk.com.tw` that bundles all credit/debit card transactions for the day.

**Email contents**: transaction date/time, merchant name, amount, card last-4-digits — all in an HTML table using `.spend_table` CSS class.

**Pros**:
- Automated, no manual intervention after setup
- Reliable data source (bank sends these consistently)
- Covers both credit card and debit card transactions
- Existing precedent (n8n Taiwan bank workflows already do this — see hanamizuki.tw)
- Good merchant name data (Cathay is known for best-in-class merchant details)

**Cons**:
- Daily batch only (not real-time, ~24hr delay)
- HTML format may change without notice (fragile parsing)
- Only covers spending — may not cover incoming transfers, ATM withdrawals

### Solution 2: Bank Statement CSV/OFX Export Parsing
**Parse manually exported bank statements from Cathay Mybank**

**Pros**: Simplest, structured data, no API auth needed on bank side
**Cons**: Requires manual download step, not fully automated

### Solution 3: Web Scraping Cathay Mybank Online Banking
**Automate browser login and scrape transaction data**

**Pros**: Fully automated, real-time access to all transaction types
**Cons**: Most fragile, security risk (stored credentials), anti-bot measures, potential ToS violation

---

## Chosen Approach: n8n + Email Parsing

We will use **self-hosted n8n (free/open-source)** to orchestrate the email-to-YNAB sync workflow. n8n provides:
- Built-in Gmail integration (OAuth 2.0)
- Built-in HTML parsing capabilities
- Code nodes for custom JavaScript transformation logic
- HTTP Request nodes for YNAB API calls
- Cron/schedule triggers for automated runs
- A visual workflow editor for easy maintenance
- Existing community precedent for this exact Taiwan bank use case

### Why n8n over custom Python?
- **Less code to maintain** — Gmail auth, scheduling, error handling, and retries are all built-in
- **Visual workflow** — easier to debug and modify
- **Existing patterns** — hanamizuki.tw blog documents an n8n workflow parsing Cathay emails
- **Self-hosted = free** — n8n Community Edition is MIT-licensed and free to run via Docker

---

## Implementation Plan

### Phase 1: n8n Infrastructure Setup
- [ ] Create `docker-compose.yml` for self-hosted n8n
  - n8n service with persistent data volume
  - SQLite (default) or PostgreSQL for workflow storage
  - Environment variables for encryption key, timezone (Asia/Taipei)
- [ ] Add `.env.example` with required configuration variables
- [ ] Verify n8n is running and accessible

### Phase 2: Gmail Connection & Email Fetching
- [ ] Configure Gmail OAuth 2.0 credentials in n8n
  - Create Google Cloud project, enable Gmail API
  - Create OAuth 2.0 credentials (Desktop app type)
  - Connect Gmail account in n8n credentials
- [ ] Create workflow with **Schedule Trigger** node (run daily or every few hours)
- [ ] Add **Gmail** node to search for Cathay spending summary emails
  - Filter: `from:service@pxbillrc01.cathaybk.com.tw subject:國泰世華銀行消費彙整通知`
  - Fetch unread/new emails since last run
- [ ] Add logic to mark processed emails (label or read status) to avoid re-processing

### Phase 3: Email Parsing (HTML → Structured Data)
- [ ] Add **HTML Extract** node or **Code** node to parse email body
- [ ] Extract per-transaction data from `.spend_table` HTML elements:
  - Transaction date/time
  - Merchant name (payee)
  - Amount (TWD)
  - Card last-4-digits
- [ ] Use **Code** node (JavaScript) for any complex parsing:
  - Split one email into multiple transaction items
  - Clean up merchant names
  - Handle foreign currency transactions, refunds
- [ ] Add **IF** node to skip emails with no parseable transactions

### Phase 4: YNAB Integration
- [ ] Store YNAB Personal Access Token in n8n credentials (HTTP Header Auth)
- [ ] Add **Code** node to transform parsed transactions to YNAB format:
  - `date`: ISO 8601 from parsed date
  - `amount`: Convert TWD to milliunits (multiply by -1000 for outflows, -1 because spending is outflow)
  - `payee_name`: Merchant name from email
  - `memo`: Card last-4-digits, original currency if foreign
  - `import_id`: Generate `YNAB:[milliunit_amount]:[iso_date]:[occurrence]` for deduplication
  - `cleared`: `"cleared"`
  - `account_id`: From config/environment
- [ ] Add **HTTP Request** node to POST transactions to YNAB API
  - URL: `https://api.youneedabudget.com/v1/budgets/{budget_id}/transactions`
  - Method: POST
  - Auth: Bearer token
  - Body: `{ "transactions": [...] }`
- [ ] Handle YNAB duplicate response (transactions with existing `import_id` are silently skipped)

### Phase 5: Error Handling & Notifications
- [ ] Add error handling workflow (n8n Error Trigger)
- [ ] Optional: Add notification on success/failure (e.g., n8n sends a summary via email or webhook)
- [ ] Add logging via n8n execution history

### Phase 6: Export & Documentation
- [ ] Export the completed n8n workflow as JSON and save to repo
- [ ] Write README with:
  - Prerequisites (Docker, Google Cloud project, YNAB account)
  - Step-by-step setup instructions
  - How to import the workflow into n8n
  - Configuration variables reference
  - How to test the workflow
- [ ] Add `.env.example` and `docker-compose.yml` to repo

### Repository Structure
```
ynab-taiwan-sync/
├── LICENSE
├── README.md
├── docker-compose.yml          # Self-hosted n8n setup
├── .env.example                # Required environment variables
└── workflows/
    └── cathay-to-ynab.json     # Exported n8n workflow
```
