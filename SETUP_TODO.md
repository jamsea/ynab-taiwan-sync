# Setup Todo List

Things to do on your desktop to get Cathay → YNAB sync running.

## One-Time Setup

- [ ] Install Docker and Docker Compose (if not already installed)
- [ ] Clone this repo and `cp .env.example .env`
- [ ] Generate a random string for `N8N_ENCRYPTION_KEY` in `.env`
- [ ] Run `docker compose up -d` to start n8n
- [ ] Open n8n at `http://localhost:5678` and create an account

## Google Cloud / Gmail Setup

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
- [ ] Enable the **Gmail API** for that project
- [ ] Go to **APIs & Services** → **OAuth consent screen** → set up (External is fine for personal use)
- [ ] Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
  - Application type: **Web application**
  - Authorized redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
- [ ] Copy the **Client ID** and **Client Secret**

## YNAB Setup

- [ ] Log in to [app.ynab.com](https://app.ynab.com)
- [ ] Go to **Account Settings** → **Developer Settings**
- [ ] Click **New Token** to create a Personal Access Token — save it somewhere safe
- [ ] Note your **Budget ID** — from the URL: `app.ynab.com/{BUDGET_ID}/...`
- [ ] Note your **Account ID** — navigate to the account you want to sync to, ID is in the URL: `.../accounts/{ACCOUNT_ID}`

## n8n Workflow Setup

- [ ] In n8n, go to **Workflows** → **Import from File** → select `workflows/cathay-to-ynab.json`
- [ ] Set up Gmail credential in n8n:
  - Go to **Credentials** → **New** → **Gmail OAuth2**
  - Paste your Google Client ID and Client Secret
  - Click **Sign in with Google** and authorize
- [ ] Set up YNAB credential in n8n:
  - Go to **Credentials** → **New** → **Header Auth**
  - Name: `Authorization`
  - Value: `Bearer YOUR_YNAB_TOKEN`
- [ ] Update workflow nodes:
  - Open the **"Fetch Cathay Emails"** node → select your Gmail credential
  - Open the **"Transform to YNAB Format"** Code node → replace `CONFIGURE_ME` with your `YNAB_ACCOUNT_ID`
  - Open the **"POST to YNAB"** HTTP node → replace `CONFIGURE_ME` in the URL with your `YNAB_BUDGET_ID`
  - Open the **"POST to YNAB"** HTTP node → select your YNAB Header Auth credential
  - Open the **"Mark Email as Read"** node → select your Gmail credential
- [ ] **Test the workflow** manually by clicking "Execute Workflow" in n8n
- [ ] **Activate** the workflow (toggle in top right) so it runs on schedule

## Verify It Works

- [ ] Make sure you have Cathay email notifications enabled (daily spending summary: "國泰世華銀行消費彙整通知")
- [ ] Wait for a spending summary email to arrive (or find an existing unread one)
- [ ] Run the workflow manually and check:
  - Does the Gmail node find emails?
  - Does the parser extract transactions correctly?
  - Do transactions appear in YNAB?
- [ ] Check YNAB to confirm transactions synced with correct amounts and merchant names
