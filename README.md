# NameGuard 🛡️

Anti-squatting scoring service for NEAR accounts.

## Contract

Rust smart contract for NEAR blockchain that evaluates whether an account looks like a squatter.

### Score factors

| Factor | Max score | Description |
|---|---|---|
| name_length | 30 | Very short names (1-2 chars: +30, 3-4 chars: +15) |
| auto_generated | 25 | Pattern matches bots (digits only, letter+digits) |
| trademark | 50 | Name matches a protected trademark |
| many_accounts | 35 | Creator owns more accounts than allowed |

Total score capped at **100**. Higher = more likely a squatter.

### Build & Deploy

```bash
# Build WASM
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release

# Deploy (testnet)
near deploy nameguard.testnet ./target/wasm32-unknown-unknown/release/near_antisquat.wasm

# Init
near call nameguard.testnet new '{"max_accounts_per_owner": 5}' --accountId nameguard.testnet

# Check an account
near call nameguard.testnet check '{"account_id": "suspicious.near"}' --accountId nameguard.testnet

# Add trademark
near call nameguard.testnet add_trademark '{"name": "google"}' --accountId nameguard.testnet
```

## Frontend

React + Vite + near-api-js.

```bash
cd frontend
npm install
npm run dev
```

## Structure

```
├── Cargo.toml
├── src/
│   └── lib.rs          # NEAR contract
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── vite-env.d.ts
│       └── near/
│           ├── config.ts
│           └── wallet.ts
└── README.md
```