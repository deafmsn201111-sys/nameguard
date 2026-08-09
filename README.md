# 🛡️ NameGuard

> **Anti-Squatting Scoring Engine for NEAR Protocol**

**Live contract on testnet:** `nameguard.testnet`
**Frontend:** Coming soon

---

## The Problem

Every day thousands of accounts are created on NEAR. Many are legitimate users — but a growing share are **squatters** who grab short names and brand accounts, hoping to flip them later.

Manually telling a real user from a squatter doesn't scale. Projects need an **automated, transparent, on-chain reputation signal**.

## What NameGuard Does

NameGuard is a Rust smart contract that analyzes a NEAR account across multiple dimensions and returns a **score from 0 to 100**.

The higher the score, the more likely the account is a squatter.

### Scoring Factors

| Factor | Max | What It Detects |
|---|---|---|
| `name_length` | 30 | 1–2 chars → +30, 3–4 chars → +15 |
| `auto_generated` | 25 | Digits-only or letter+digits patterns |
| `trademark` | 50 | Name matches a protected brand |
| `no_profile` | 15 | No profile on **SocialDB** (`social.near`) |

**Score is capped at 100.** Multiple factors stack.

---

## Current Status ✅

| Milestone | Status |
|---|---|
| Contract deployed (testnet) | ✅ `nameguard.testnet` |
| Scoring logic | ✅ Name length, auto-generate, trademarks |
| SocialDB cross-contract lookup | ✅ Checks `social.near` for profile presence |
| Trademark management | ✅ Add / remove / list (owner-only) |
| Unit tests | ✅ Auto-generate detection, cumulative scoring |
| GitHub repo | ✅ Public, MIT license, contributors welcome |

### Live Demo

```bash
near contract call-function as-transaction nameguard.testnet check \
  json-args '{"account_id":"google.near"}' prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' sign-as nameguard.testnet \
  network-config testnet sign-with-keychain send
```

```json
{
  "account_id": "google.near",
  "overall_score": 50,
  "reasons": [
    {
      "detail": "Name matches protected trademark: google",
      "factor": "trademark",
      "score": 50
    }
  ]
}
```

```bash
near contract call-function as-transaction nameguard.testnet check \
  json-args '{"account_id":"a12345.near"}' prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' sign-as nameguard.testnet \
  network-config testnet sign-with-keychain send
```

```json
{
  "account_id": "a12345.near",
  "overall_score": 40,
  "reasons": [
    { "factor": "name_length", "score": 15 },
    { "factor": "auto_generated", "score": 25 }
  ]
}
```

---

## Roadmap 🔜

### Short-term (weeks)

- [ ] **React frontend** — Vite + near-api-js, ready for deployment
- [ ] **Trademark seed list** — load Fortune 500 + top-1000 web3 brands
- [ ] **Indexer integration** — on-chain creator analysis (`many_accounts` factor)

### Medium-term

- [ ] **MEV-resistant oracle** for reliable bulk account creation data
- [ ] **Appeals mechanism** — allowlist for legitimate brand owners
- [ ] **Near Discovery / BOS widget** — score accounts directly from the social feed
- [ ] **Public REST API** for external integrations

### Pre-mainnet

- [ ] **Security audit** (OpenBrush / Kudelski / Code4rena)
- [ ] **Governance — who adds trademarks?** DAO or multi-sig
- [ ] **Mainnet deployment** with filled trademark database

---

## Why This Matters

- **NEAR Foundation** — on-chain anti-squatting infrastructure
- **Name marketplaces** — filter risky accounts before listing
- **dApps** — verify new users at registration
- **The community** — open-source defense against name squatting

---

## Quick Start for Developers

```bash
# Build
git clone https://github.com/deafmsn201111-sys/nameguard
cd nameguard
cargo build --target wasm32-unknown-unknown --release

# Deploy
near contract deploy nameguard.testnet use-file \
  ./target/wasm32-unknown-unknown/release/nameguard.wasm \
  without-init-call network-config testnet sign-with-keychain send

# Init
near contract call-function as-transaction nameguard.testnet new \
  json-args '{"max_accounts_per_owner":5}' prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' sign-as nameguard.testnet \
  network-config testnet sign-with-keychain send

# Add a trademark
near contract call-function as-transaction nameguard.testnet add_trademark \
  json-args '{"name":"google"}' prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' sign-as nameguard.testnet \
  network-config testnet sign-with-keychain send

# Score an account
near contract call-function as-transaction nameguard.testnet check \
  json-args '{"account_id":"vitalik.near"}' prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' sign-as nameguard.testnet \
  network-config testnet sign-with-keychain send
```

---

## Frontend

React + Vite + near-api-js (in `frontend/`).

```bash
cd frontend
npm install
npm run dev
```

## Structure

```
├── Cargo.toml
├── src/lib.rs              # NEAR contract
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── vite-env.d.ts
│       └── near/
│           ├── config.ts
│           └── wallet.ts
├── README.md
├── NAMEGUARD_POST.md       # Post for NEAR Builders / social media
└── .gitignore
```

## Connect

| Channel | Link |
|---|---|
| GitHub | [github.com/deafmsn201111-sys/nameguard](https://github.com/deafmsn201111-sys/nameguard) |
| Smart Contract (testnet) | `nameguard.testnet` |
| Explorer | [explorer.testnet.near.org](https://explorer.testnet.near.org/accounts/nameguard.testnet) |
| Issues / Ideas | [GitHub Issues](https://github.com/deafmsn201111-sys/nameguard/issues) |

---

**Built on NEAR Protocol**  
**Stack:** Rust · NEAR SDK 5.x · SocialDB · Wasm  
**License:** MIT

*Contributions, forks, and feedback welcome. Let's keep NEAR names fair.*