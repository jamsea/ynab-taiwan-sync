# ynab-taiwan-sync

Sync Taiwan bank transactions to [YNAB](https://ynab.com) using self-hosted [n8n](https://n8n.io).

**Supported banks:**
- **Cathay United Bank** (國泰世華銀行) — daily consolidated spending summary emails
- **HSBC Taiwan** (匯豐銀行台灣) — per-transaction credit card alert emails *(parser pending — awaiting email sample)*

## How It Works

Each supported bank has its own n8n workflow that:

1. **Fetches** unread bank notification emails from Gmail
2. **Parses** the HTML to extract transaction details (date, merchant, amount, card)
3. **Transforms** transactions into YNAB API format (milliunits, deduplication IDs)
4. **POSTs** transactions to YNAB via the API
5. **Marks** processed emails as read

The workflows run on a schedule (default: every 6 hours).

## Prerequisites

- **Docker** and **Docker Compose** installed
- A **Gmail** account that receives Cathay bank notification emails
- A **Google Cloud** project with Gmail API enabled (for OAuth 2.0)
- A **YNAB** account with a Personal Access Token

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/jamsea/ynab-taiwan-sync.git
cd ynab-taiwan-sync
cp .env.example .env
```

Edit `.env` and set:
- `N8N_ENCRYPTION_KEY` — a random string for encrypting n8n credentials

### 2. Start n8n

```bash
docker compose up -d
```

n8n will be available at `http://localhost:5678`.

### 3. Configure Gmail OAuth 2.0

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add `http://localhost:5678/rest/oauth2-credential/callback` as an authorized redirect URI
7. Note the **Client ID** and **Client Secret**

### 4. Configure YNAB

1. Go to [YNAB Account Settings](https://app.ynab.com/settings) → **Developer Settings**
2. Click **New Token** to generate a Personal Access Token
3. Note your **Budget ID** and **Account ID** (find these via the YNAB web app URL: `app.ynab.com/{budget_id}/accounts/{account_id}`)

### 5. Import the workflows

#### Cathay United Bank

1. Open n8n at `http://localhost:5678`
2. Go to **Workflows** → **Import from File**
3. Select `workflows/cathay-to-ynab.json`
4. Configure credentials:
   - **Gmail**: Add your Google OAuth 2.0 Client ID and Secret
   - **YNAB**: Add an HTTP Header Auth credential with name `Authorization` and value `Bearer YOUR_YNAB_TOKEN`
5. Update the workflow variables:
   - In the "Transform to YNAB Format" Code node: set your `YNAB_ACCOUNT_ID`
   - In the "POST to YNAB" HTTP Request node: set your `YNAB_BUDGET_ID` in the URL
6. **Activate** the workflow

#### HSBC Taiwan

1. Go to **Workflows** → **Import from File**
2. Select `workflows/hsbc-to-ynab.json`
3. Configure the same Gmail and YNAB credentials as above
4. Update the workflow variables (same `YNAB_ACCOUNT_ID` and `YNAB_BUDGET_ID`)
5. **Activate** the workflow

> **Note:** The HSBC parser is currently a placeholder. Once a real HSBC email sample is provided, the parser in the "Parse HSBC Email HTML" code node will be implemented.

## Testing

The parsing and transformation logic is extracted into standalone JavaScript modules with tests:

```bash
npm test
```

## Project Structure

```
ynab-taiwan-sync/
├── docker-compose.yml              # Self-hosted n8n
├── .env.example                    # Environment variables
├── workflows/
│   ├── cathay-to-ynab.json         # Cathay n8n workflow
│   └── hsbc-to-ynab.json           # HSBC n8n workflow
├── src/
│   ├── htmlUtils.ts                # Shared HTML utilities (stripHtml)
│   ├── parseCathayEmail.ts         # Cathay email parser
│   ├── parseHsbcEmail.ts           # HSBC email parser (stub)
│   └── transformToYnab.ts          # YNAB format transformer
└── tests/
    ├── parseCathayEmail.test.ts     # Cathay parser tests
    ├── parseHsbcEmail.test.ts       # HSBC parser tests
    └── transformToYnab.test.ts      # Transformer tests
```

## Email Details

### Cathay United Bank

| Field | Value |
|-------|-------|
| Sender | `service@pxbillrc01.cathaybk.com.tw` |
| Subject | `國泰世華銀行消費彙整通知` |
| Format | HTML with `.spend_table` CSS class |
| Frequency | Daily (consolidated, multiple transactions per email) |
| Covers | Credit card and debit card transactions |

### HSBC Taiwan

| Field | Value |
|-------|-------|
| Sender | `enotification@mail.hsbc.com.tw` |
| Subject | `匯豐銀行信用卡交易警示` |
| Format | HTML (exact format TBD — awaiting sample) |
| Frequency | Per-transaction (one email per transaction) |
| Threshold | Domestic in-person >= NT$3,000; all online/overseas transactions |

## YNAB API Notes

- Amounts use **milliunits**: 1 TWD = 1,000 milliunits (e.g., 150 TWD = 150,000 milliunits)
- Outflows (spending) are **negative**
- Deduplication is handled via `import_id` field: `YNAB:{amount}:{date}:{occurrence}`
- Rate limit: 200 requests per 60 minutes
- Multiple transactions can be batch-created in a single POST
