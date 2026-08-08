# NEAR NameGuard 🔒

**Anti-squatting protection for NEAR accounts**

Check if a NEAR account is a squatter, report suspicious accounts, and manage your watchlist — all on-chain.

---

## Why?

- Squatters mass-register `.near` domains and resell them
- New users inherit spam activity from previous owners
- Projects lose their brand name to impersonators

NameGuard solves this with community-driven reporting + risk scoring.

## Features

- ✅ **Risk Score** — check any `.near` account (0-100)
- ✅ **Report** — flag squatters, impersonators, spam
- ✅ **Watchlist** — track suspicious accounts
- ✅ **Transparent** — all data on-chain, no central DB

## Quick Start

```bash
# 1. Install tools
npm install -g near-cli
cargo install cargo-near

# 2. Auth
near login

# 3. Build & deploy to testnet
cd contract
cargo near build
near deploy nameguard.testnet --wasmFile target/wasm32-unknown-unknown/release/nameguard.wasm

# 4. Try it
near view nameguard.testnet get_risk_score '{"account_id": "test.near"}'
near call nameguard.testnet report_account \
  '{"account_id": "suspicious.near", "reason": "Squatter", "description": "Mass registered"}' \
  --accountId YOUR_ACCOUNT.near --deposit 0.001
```

## Contract Methods

| Method | Type | Description |
|--------|------|-------------|
| `get_risk_score(account_id)` | View | Returns RiskScore (0-100) with flags |
| `get_reports(account_id)` | View | List all reports on account |
| `is_watched(account_id)` | View | Check if account is watched |
| `get_watchers(account_id)` | View | Who's watching this account |
| `report_account(...)` | Call (0.001N) | Report an account |
| `add_to_watchlist(...)` | Call (0.001N) | Watch an account |
| `remove_from_watchlist(...)` | Call | Stop watching |

## Deploy to Mainnet

```bash
near create-account nameguard.near --masterAccount YOUR_MAIN.near --initialBalance 5
near deploy nameguard.near --wasmFile target/wasm32-unknown-unknown/release/nameguard.wasm
near call nameguard.near new --accountId nameguard.near
```

## Frontend (coming soon)

React + Next.js app with search, risk meter, report form, watchlist dashboard, and account history via NearBlocks API.

## Tech Stack

- **Smart Contract:** Rust + NEAR SDK
- **Frontend:** React, Next.js, Tailwind CSS
- **Infrastructure:** NEAR Protocol, NearBlocks API, Vercel

## License

MIT