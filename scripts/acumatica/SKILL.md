/**
 * Power Smart Acumatica CLI — SKILL.md
 *
 * Follows printing-press-library CLI skill pattern.
 * This is the agent-facing instruction set for ps-acumatica.
 *
 * CLI: `npx tsx scripts/acumatica/cli.ts`
 * Auth: Cookie-based session (primary) with OAuth ROPC fallback (requires Connected App)
 * Reference: https://help-2024r2.acumatica.com (Contract-Based REST API)
 *
 * VERIFIED: 2026-05-13 against amerisuninc.acumatica.com Test tenant
 * - Login: working via POST /entity/auth/login with company=AmeriSun Inc. - Test
 * - Status: connected, entity access confirmed (Customer API)
 * - Push Sales Order: SO574025 created (Customer C51557)
 * - Push Warranty Case: b2bb16d2-0c4f-f111-8373-12d0815135bb created
 */

# ps-acumatica — Power Smart Acumatica CLI

Agent-first CLI for Acumatica ERP integration.
Pushes sales orders and warranty cases from structured intake into Acumatica via the Contract-Based REST API.
Uses cookie-based session auth with OAuth ROPC fallback.

## Quick Start

```bash
# One-time config (stores to ~/.acumatica-config.json)
npx tsx scripts/acumatica/cli.ts config

# Login via cookie-based session (NO Connected App required)
npx tsx scripts/acumatica/cli.ts login

# Test connection (OAuth fallback → cookie auth)
npx tsx scripts/acumatica/cli.ts status

# Pipe order JSON
cat order.json | npx tsx scripts/acumatica/cli.ts push-order

# Pipe warranty JSON
cat warranty.json | npx tsx scripts/acumatica/cli.ts push-warranty

# Push both together
cat combined.json | npx tsx scripts/acumatica/cli.ts push-both
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate via cookie-based session (works without Connected App) |
| `setup-app` | Show Connected Application setup guide for OAuth ROPC |
| `config` | Interactive config setup (baseUrl, tenant, username, password) |
| `show-config` | Display current config (password masked) |
| `status` | Test Acumatica connection (tries OAuth → falls back to cookie auth) |
| `push-order` | Create/update a Sales Order (JSON via stdin) |
| `push-warranty` | Create a Case for warranty (JSON via stdin) |
| `push-both` | Push order + warranty together (JSON via stdin) |

## Auth Architecture

Two auth paths, attempted in order by `apiRequest()`:

1. **OAuth ROPC** (preferred when available):
   - POST to `/identity/connect/token` with `grant_type=password`
   - Uses `Authorization: Bearer <token>` header
   - Requires a Connected Application registered in Acumatica (SM303010)
   - Client ID: `api`, Flow: Resource Owner Password Credentials

2. **Cookie-based Session** (fallback — works without Connected App):
   - POST to `/entity/auth/login` with `company=AmeriSun Inc. - Test`
   - Uses curl internally for reliable Set-Cookie capture
   - Parses Netscape cookie jar format → `name=value; ` format
   - Stores at `~/.acumatica-cookies.txt`
   - Session valid for ~1 hour; run `ps-acumatica login` to refresh

**Status output confirms which auth method was used:**
```json
{
  "status": "connected",
  "tenant": "Test",
  "auth": "cookie",
  "entityTest": "OK",
  "sampleCustomer": "Amazon Vendor Central"
}
```

## Prerequisites

### For Cookie Auth (zero-config, POC-ready):
- Acumatica sandbox credentials in `~/.acumatica-config.json`
- Company name matching the Acumatica tenant (e.g., "AmeriSun Inc. - Test")

### For OAuth ROPC (production):
- Connected Application created at SM303010 with client_id=`api`, ROPC flow, scopes=`api offline_access`
- Run `ps-acumatica setup-app` for a step-by-step setup guide

## Configuration

Config stored at `~/.acumatica-config.json`:

```json
{
  "baseUrl": "https://amerisuninc.acumatica.com",
  "tenant": "Test",
  "username": "Agent",
  "password": "***",
  "company": "AmeriSun Inc. - Test"
}
```

The `company` field is used for cookie-based auth (must match the company name in Acumatica).

## STDIN Formats

### push-order
```json
{
  "customerName": "Jason Mack",
  "phone": "+19053755421",
  "email": "jaysonmon@live.ca",
  "address": "143A Balls Lane Cobourg ON K9A2L4",
  "platform": "Homedepot",
  "orderNumber": "840432706992",
  "orderedDate": "2026-05-11",
  "productCategory": "Gas Lawn Mower",
  "modelSku": "DB8721P",
  "serialNumber": "0012412033380609022"
}
```

### push-warranty
```json
{
  "claimantName": "Jason Mack",
  "phone": "+19053755421",
  "email": "jaysonmon@live.ca",
  "address": "143A Balls Lane Cobourg ON K9A2L4",
  "productCategory": "Gas Lawn Mower",
  "modelSku": "DB8721P",
  "serialNumber": "0012412033380609022",
  "platform": "Homedepot",
  "orderNumber": "840432706992",
  "purchaseDate": "2026-05-11",
  "validationResult": "validated",
  "validationNotes": "Retailer recognized. All field checks passed. Receipt confirmed."
}
```

## Known Constraints (Production Deployment)

### Sales Order CustomerID
- Acumatica `CustomerID` field has a 10-character limit
- Email addresses are truncated → matches may fail
- **Solution**: Either pre-create Customers via the Customer API, or use the `CustomerID` segment key lookup
- **POC verified**: Customer creation → Sales Order linkage works end-to-end

### Date Format
- Must use ISO 8601: `2026-05-11T00:00:00.000`
- The CLI's `wrap()` function formats dates correctly
- Acumatica auto-numbering requires `Date` to have a value for `<NEW>` orders

### Connected Application
- OAuth ROPC requires manual Connected Application creation at SM303010
- The SOAP endpoint for SM303010 exists but returns empty responses for programmatic creation
- Use the browser-based SM303010 screen for one-time setup
- Once created, the client secret appears once — save it securely

## API Endpoints

- `PUT /entity/Default/22.200.001/SalesOrder` — creates/updates sales orders
- `PUT /entity/Default/22.200.001/Case` — creates/updates warranty cases
- `GET /entity/Default/22.200.001/Customer?$top=1` — connection test
- `POST /entity/auth/login` — cookie-based session auth

All values are wrapped as `{"value": "..."}` per Acumatica contract-based format.

## Verified Pipeline Run (2026-05-13)

Against amerisuninc.acumatica.com (Test tenant, AmeriSun Inc. - Test company):

| Step | Result |
|------|--------|
| Login (`ps-acumatica login`) | ✅ Session valid, entity access confirmed |
| Status (`ps-acumatica status`) | ✅ `connected`, `auth: cookie`, `entityTest: OK` |
| Customer creation | ✅ C51557 (Jason Mack, jaysonmon@live.ca) |
| Sales Order push | ✅ SO574025 created (Status: Open, Customer: C51557) |
| Warranty Case push | ✅ Case ID: b2bb16d2 created |
| Extraction (Jason Mack) | ✅ 10/10 fields, 0 errors, 0 warnings |
| Receipt validation | ✅ Home Depot receipt confirmed |

## Exit Codes

- `0` — success
- `1` — error (auth failed, invalid input, API error)

## Output

All output is JSON to stdout. Errors are JSON to stderr.

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "OrderNbr": { "value": "SO574025" }, "Status": { "value": "Open" } }
}
```

```json
{
  "success": false,
  "statusCode": 500,
  "error": "...Acumatica error detail..."
}
```

## Dependencies

- Node.js 18+ (uses native `fetch`)
- `curl` (for reliable cookie capture during login)
- No npm dependencies beyond Node.js standard library
- Config file at `~/.acumatica-config.json`
- Cookie jar at `~/.acumatica-cookies.txt`
