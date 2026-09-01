# ⚡ P2P Escrow — GenLayer

A peer-to-peer crypto-to-fiat escrow system powered by **GenLayer AI consensus**. Designed for the most common real-world crypto use case: cashing out crypto to local fiat currency (IDR, USD, MYR, etc.) directly between wallets — no exchange, no intermediary, no trust required.

---

## What it does

Users trade crypto for fiat daily. The usual problem: one party has to send first and trust the other. P2P Escrow eliminates that risk:

- **Seller** locks crypto in the smart contract
- **Buyer** pays fiat off-chain (bank transfer, GoPay, OVO, etc.)
- **Buyer** uploads proof of payment (screenshot URL)
- **Seller** releases crypto — or disputes if payment looks wrong
- **AI arbiter** reads the proof directly and issues a binding verdict

No human moderator. No manual review. The AI fetches the proof URL, verifies the amount and payment method, and releases funds automatically.

---

## Contracts

| Contract | File | Purpose |
|---|---|---|
| `P2PEscrow` | `contracts/p2p_escrow.py` | Trade lifecycle, escrow, AI arbitration |
| `TraderReputation` | `contracts/trader_reputation.py` | On-chain reputation scoring per address |

### Trade flow

```
post_offer()                 Seller locks crypto, sets fiat rate + payment methods
     ↓
lock_order()                 Buyer commits — AI validates rate is within ±10% of market
     ↓
mark_paid()                  Buyer pays fiat off-chain, uploads proof URL
     ↓
release_crypto()             Seller confirms payment → crypto sent to buyer  ✅
     OR
open_dispute()               Seller disputes → AI reads proof → verdict
     OR
escalate_after_seller_timeout()  Buyer escalates if seller goes silent
     ↓
arbitrate()                  AI fetches proof, decides: release or refund
```

### Key features

- **Rate guard** — AI fetches live market price (CoinGecko) at order time. Offers > ±10% deviation are rejected automatically
- **Reputation system** — traders need ≥ 80% success rate to trade. New traders (< 3 trades) get a grace period
- **AI proof verification** — the AI reads the actual payment screenshot URL, not just metadata
- **Timeouts** — buyer has 1h to pay, seller has 30min to release after proof is submitted
- **Supported tokens** — GEN (native), USDT (planned)

---

## Deploy order

> Constructor arguments are not yet supported in GenLayer Studio. Both contracts use the setter pattern.

```
1. Deploy TraderReputation           # no constructor args needed
   → note the address (e.g. 0xAAA…)

2. Deploy P2PEscrow                  # no constructor args needed
   → note the address (e.g. 0xBBB…)

3. Call TraderReputation.set_escrow_contract("0xBBB…")
   # from the deployer wallet

4. Call P2PEscrow.set_reputation_contract("0xAAA…")
   # from the deployer wallet
```

---

## Frontend

React + Vite dApp that connects directly to the deployed contracts via `genlayer-js`.

### Setup

```bash
cd frontend
cp .env.example .env
# fill in your deployed contract addresses in .env

npm install
npm run dev
```

### .env

```env
VITE_P2P_ESCROW_ADDRESS=0x...    # your deployed P2PEscrow address
VITE_REPUTATION_ADDRESS=0x...    # your deployed TraderReputation address
```

### Pages / Tabs

| Tab | Role | Action |
|---|---|---|
| 1. Sell Crypto | Seller | Post offer, lock crypto |
| 2. Lock Order | Buyer | Commit to trade (AI rate check) |
| 3. Submit Proof | Buyer | Mark paid + upload screenshot URL |
| 4. Release | Seller | Release or dispute |
| 5. AI Arbiter | Anyone | Trigger AI arbitration |
| Reputation | Anyone | Look up any trader's score |

---

## Planned upgrades

- [ ] ERC-20 support (USDT on-chain, not just native GEN)
- [ ] Constructor argument deploy (once GenLayer Studio supports it)
- [ ] Appeal layer for high-value disputes (2-round AI arbitration)
- [ ] Offer board — multiple open offers listed simultaneously
- [ ] Chat between buyer/seller (encrypted, off-chain)
- [ ] Mobile-responsive UI improvements

---

## Built on

- [GenLayer](https://genlayer.com) — Intelligent Contracts with AI consensus
- [genlayer-js](https://github.com/yeagerai/genlayer-js) — JavaScript SDK
- React + Vite
