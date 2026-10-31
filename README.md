<div align="center">

# Vouch

**Under-collateralized lending on verifiable reputation — settled by decentralized consensus.**

*Connect identity to credit. Borrow against risk, not against lockups.*

[![Chain](https://img.shields.io/badge/Chain-GenLayer%20Testnet-4fb99f?style=flat-square)](https://genlayer.com)
[![Status](https://img.shields.io/badge/Status-Live-7fd4bf?style=flat-square)](https://genlayer.com)
[![Contract](https://img.shields.io/badge/Contract-UnderCollateralizedLending-4fb99f?style=flat-square)](https://github.com/genlayer)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat-square)](https://nextjs.org)

</div>

---

**Vouch** is an intelligent-contract lending protocol that under-collateralizes credit by
bridging real-world identity attestations into on-chain reputation. Instead of demanding
150%+ collateral from users who simply lack a banking history, Vouch lets validators —
through the GenLayer consensus engine — evaluate attested financial data and publish a
trust score that governs borrowing capacity.

The result: **the same risk that would normally require over-collateralization becomes a
priced, liquid, auditable loan.**

---

## 📖 Table of Contents

- [How It Works](#-how-it-works)
- [Features](#-features)
- [The Contract](#-the-contract)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Testing](#-testing)

---

## 🔁 How It Works

```
Verify identity → Score on-chain → Apply → Receive funds → Repay → Repeat
```

1. **Verify identity** — A borrower links a wallet to a verifiable credential
   (OAuth / email / one-time passcode) via an external provider. Only the cryptographic
   proof ever touches the ledger.
2. **Score on-chain** — Validators read the attested history and agree on a reputation
   score. The result is published on-chain, auditable by anyone, immutable by construction.
3. **Apply for a loan** — The borrower picks amount and term. Interest adapts to the score,
   the term, and live market volatility. The quote is the quote.
4. **Receive funds** — Once validator quorum approves the proposal, capital settles
   directly to the borrower wallet through the lending contract. No escrow, no waiting window.

## ✨ Features

- **On-chain reputation** — Validator-consensus scores, public, auditable, unalterable.
- **Adaptive interest** — Rates derived from score, term, and volatility read from live
  contract state.
- **Real-time explorer** — Every proposal, quorum, and settlement queryable as it happens.
- **Reduced collateral** — Collateral requirements proportional to actual risk exposure.
- **Transparent settlement** — Repayment schedules and collateral ratios update in the
  same immutable transaction that funded the loan.

## 📜 The Contract

- **Contract class:** `UnderCollaterizedLending`
- **Pinned runner:** `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- **Deployed (testnet):** `0x4F0367C3c238A70dFc79D9a1f35Acaa037F7388C`
- **Methods:** 11 (6 write · 5 view) — lint-validated with `genvm-lint check`

Key write methods: `fund_loan`, `disburse_loan`, `repay_loan`, `liquidate_loan`, plus
profile management entry points. Read methods cover loan counts, loan lists, borrower
profiles, and per-loan lookups.

## 🏗 Architecture

```
┌─────────────────────┐        ┌──────────────────────┐
│   Next.js Frontend  │  RPC  │  GenLayer RPC        │
│   (App Router)       │ ────▶ │  (studio.genlayer.com)│
└─────────────────────┘        └───────────┬──────────┘
        │                                     │
        │  EIP-6963 / EIP-1193 (MetaMask│  GenVM validators
        │  / Rabby)                         │  → consensus
        │                                     │
        └───────────────┬─────────────────┘
                        │
              ┌─────────▼──────────┐
              │ UnderCollateralized│
              │       Lending      │
              │   (GenLayer VM)    │
              └────────────────────┘
```

- **Frontend** → Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 ·
  "Ledger Ink" design system (ink `#08110e`, bone `#e9e4d8`, verdigris `#4fb99f`, seal `#d2a64c`).
- **Wallet** → EIP-6963 multi-wallet discovery with silent session restore
  (`vouch.wallet.rdns`).
- **RPC** → `/api/rpc` Next.js route proxying JSON-RPC to the GenLayer Studio endpoint.
- **Reads** → custom `gen_call` method with `transaction_hash_variant: "latest-nonfinal"`.
- **Writes** → wallet-signed transactions through GenLayer consensus.

## 🛠 Tech Stack

- **Smart contract:** Python · GenLayer (`py-genlayer`) · `@gl.evm.contract_interface`
- **Frontend:** Next.js 16.4.3 · React 19.3 · TypeScript · Tailwind CSS v4 · Turbopack
- **Wallet:** EIP-6963 · EIP-1193
- **Network:** GenLayer Testnet (`chainId 0xf22f`)

## 🚀 Getting Started

```bash
# 1. Clone
git clone https://github.com/weels007/vouch.git
cd vouch

# 2. Frontend
cd frontend
npm install
npm run dev        # http://localhost:3000

# 3. Lint contract
genvm-lint check contracts/UnderCollaterizedLending.py
```

## 🔐 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GENLAYER_RPC_URL` | GenLayer JSON-RPC endpoint | `https://studio.genlayer.com/api` |

## 🌐 Deployment

The frontend is a standard Next.js App Router project and deploys cleanly to Vercel:

```bash
cd frontend
vercel --prod
```

> Note: `cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`;
> route segment `runtime` config is intentionally omitted (incompatible with Cache Components).

## 🧪 Testing

```bash
genvm-lint check contracts/UnderCollaterizedLending.py
cd frontend && npx tsc --noEmit
```

---

<div align="center">
  <sub>Built on GenLayer · Printed in Ledger Ink</sub>
</div>
