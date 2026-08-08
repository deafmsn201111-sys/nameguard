# NameGuard 🛡️

Anti-squatting scoring for NEAR accounts.

## Live

**Contract:** `nameguard.testnet` (testnet)

## Contract Methods

| Method | Type | Description |
|---|---|---|
| `new(max_accounts_per_owner)` | Init | Initialize contract |
| `check(account_id)` | Call | Score an account (0-100) |
| `get_report(account_id)` | View | Get cached report |
| `add_trademark(name)` | Call | Add protected name (owner only) |
| `remove_trademark(name)` | Call | Remove protected name |
| `list_trademarks()` | View | List all trademarks |
| `set_max_accounts(max)` | Call | Set max accounts per owner |

## Scoring

| Factor | Max | What it detects |
|---|---|---|
| `name_length` | 30 | 1-2 chars → +30, 3-4 chars → +15 |
| `auto_generated` | 25 | Digits-only or letter+digits pattern |
| `trademark` | 50 | Name matches a protected trademark |
| `many_accounts` | 35 | Creator owns too many accounts *(coming soon)* |

**Total capped at 100.** Higher = more likely a squatter.

## Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Deploy

```bash
near contract deploy nameguard.testnet use-file ./target/wasm32-unknown-unknown/release/nameguard.wasm without-init-call network-config testnet sign-with-keychain send
near contract call-function as-transaction nameguard.testnet new json-args '{"max_accounts_per_owner":5}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as nameguard.testnet network-config testnet sign-with-keychain send
```

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
└── .gitignore
```

## License

MIT