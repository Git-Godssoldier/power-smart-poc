/**
 * Power Smart Acumatica CLI — SKILL.md
 *
 * Follows printing-press-library CLI skill pattern.
 * This is the agent-facing instruction set for ps-acumatica.
 *
 * CLI: `npx tsx scripts/acumatica/cli.ts`
 * Auth: OAuth ROPC via Acumatica Identity Server
 * Reference: https://help-2024r2.acumatica.com (Contract-Based REST API)
 */

# ps-acumatica — Power Smart Acumatica CLI

Agent-first CLI for Acumatica ERP integration.
Pushes sales orders and warranty cases from structured intake into Acumatica via the Contract-Based REST API.

## Quick Start

```bash
# One-time config
npx tsx scripts/acumatica/cli.ts config

# Test connection
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
| `config` | Interactive config setup (baseUrl, tenant, username, password) |
| `show-config` | Display current config (password masked) |  
| `status` | Test Acumatica connection via OAuth ROPC |
| `push-order` | Create/update a Sales Order (JSON via stdin) |
| `push-warranty` | Create a Case for warranty (JSON via stdin) |
| `push-both` | Push order + warranty together (JSON via stdin) |

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
  "validationNotes": "Retailer recognized. All field checks passed."
}
```

### push-both
```json
{
  "order": { ... },
  "warranty": { ... }
}
```

## Configuration

Config stored at `~/.acumatica-config.json`:

```json
{
  "baseUrl": "https://amerisuninc.acumatica.com",
  "tenant": "Test",
  "username": "Agent",
  "password": "***",
  "company": "AMERISUN",
  "branch": "MAIN"
}
```

## Auth Flow

1. POST to `/identity/connect/token` with `grant_type=password`
2. Get `access_token` from response
3. Use token in `Authorization: Bearer <token>` header for API calls
4. Token is obtained per-command (no persistent session)

**Prerequisite**: A Connected Application must be registered in Acumatica (SM303010) with:
- Client ID matching the one used by the CLI (default: `"api"`)
- Flow: Resource Owner Password Credentials
- Scopes: `api`, `offline_access`

## API Endpoints

- `PUT /entity/Default/22.200.001/SalesOrder` — creates/updates sales orders
- `PUT /entity/Default/22.200.001/Case` — creates/updates warranty cases

All values are wrapped as `{"value": "..."}` per Acumatica contract-based format.

## Exit Codes

- `0` — success
- `1` — error (auth failed, invalid input, API error)

## Output

All output is JSON to stdout. Errors are JSON to stderr.

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "OrderNbr": { "value": "SO000123" } }
}
```

```json
{
  "success": false,
  "error": "Auth failed (400): {\"error\":\"invalid_client\"}"
}
```

## Dependencies

- Node.js 18+ (uses native `fetch`)
- No npm dependencies beyond Node.js standard library
- Config file at `~/.acumatica-config.json`
