# Relay CRM — MCP Server Setup

Connect Claude.ai to the Relay CRM so Claude can look up contacted prospects, add new ones, and log outreach emails directly.

## Server Details

| Property | Value |
|---|---|
| **Server URL** | `https://app.getrelay.software/api/mcp` |
| **Protocol** | MCP over HTTP (JSON-RPC 2.0, `2024-11-05`) |
| **Auth** | OAuth 2.0 Authorization Code + PKCE |

---

## Step 1 — Set the API Key in Vercel

The MCP API key is the password used during the OAuth login flow.

1. Go to your [Vercel project settings → Environment Variables](https://vercel.com/dashboard)
2. Add a new variable:
   - **Name:** `MCP_API_KEY`
   - **Value:** A long random secret (generate one: `openssl rand -base64 32`)
   - **Environments:** Production + Preview
3. Redeploy so the variable takes effect.

Also add it to your local `.env` file for development:
```
MCP_API_KEY="your-secret-key-here"
```

---

## Step 2 — Connect to Claude.ai

1. Open [Claude.ai](https://claude.ai) and go to **Settings → Integrations**
2. Click **Add integration** (or the equivalent MCP connector option)
3. Enter:
   - **Name:** `Relay CRM`
   - **Server URL:** `https://app.getrelay.software/api/mcp`
4. Save — Claude.ai will automatically redirect to the Relay OAuth login page
5. On the login page, enter your `MCP_API_KEY` value and click **Authorize Access**
6. You'll be redirected back to Claude.ai — the integration is now connected

---

## OAuth Endpoints

| Endpoint | URL |
|---|---|
| **Metadata** | `GET /api/mcp/.well-known/oauth-authorization-server` |
| **Authorize** | `GET /api/mcp/oauth/authorize` |
| **Token** | `POST /api/mcp/oauth/token` |

The OAuth flow uses **Authorization Code + PKCE (S256)**. No client secret is required.

---

## Available Tools

Once connected, Claude can call these tools in any conversation:

### `get_contacted_prospects`
Returns every company in the Relay CRM prospect database.

**Returns:** Array of `{ id, companyName, website, domain, industry, status, lastContactDate, lastReplyDate, addedAt }`

**Example use:** "Before suggesting new prospects, check who we've already contacted" → Claude calls this tool automatically.

---

### `add_prospect`
Creates a new prospect record in the database.

**Arguments:**
- `companyName` *(required)* — Company name
- `website` — Website URL
- `industry` — Industry type
- `city` — Headquarters city
- `state` — State or province code
- `summary` — One-sentence description
- `fitScore` — 0–100 fit score

---

### `log_email_sent`
Records that you sent an outreach email to a prospect, and marks them as contacted.

**Arguments:**
- `prospectId` or `domain` *(one required)* — Which prospect
- `toEmail` — Recipient email address
- `subject` *(required)* — Email subject
- `body` *(required)* — Email body text
- `sentAt` — ISO timestamp (defaults to now)

---

### `get_follow_up_queue`
Returns prospects contacted more than N days ago with no reply recorded.

**Arguments:**
- `minDaysWaiting` — Minimum days since contact to include (default: 3)

**Returns:** Array sorted by last contact date (oldest first), each with `daysWaiting` field.

---

### `search_prospects`
Searches the CRM by company name or domain.

**Arguments:**
- `query` *(required)* — Search string

**Returns:** Up to 20 matching prospects.

---

## Example Claude Conversation

Once connected, you can have conversations like:

> **You:** Who have we already contacted in the cold storage industry?
>
> **Claude:** *[calls get_contacted_prospects, filters by industry]* You've contacted 3 companies in cold storage: Arctic Express (contacted 8 days ago, no reply), Midwest Cold Chain (replied, demo scheduled), and Polar Logistics (contacted yesterday).

> **You:** I just sent an outreach email to john@arcticexpress.com — subject "Multi-location ops visibility" — [paste email body]. Log it.
>
> **Claude:** *[calls log_email_sent with domain: arcticexpress.com]* Logged. Arctic Express is now marked as contacted in the CRM.

> **You:** Who's due for a follow-up?
>
> **Claude:** *[calls get_follow_up_queue]* 4 prospects are due for follow-up: Arctic Express (8 days, no reply), Frostline Distribution (5 days, no reply)…

---

## Security

- All MCP requests require a valid Bearer token (either `MCP_API_KEY` directly or an OAuth-issued token)
- OAuth tokens are HMAC-SHA256 signed with `MCP_API_KEY` — rotating the key invalidates all issued tokens
- Authorization codes expire in 5 minutes and are single-use
- Missing or invalid token → `401 Unauthorized`
- Rotate the key anytime by updating the Vercel env var and reconnecting in Claude.ai (takes ~30 seconds)
