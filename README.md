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

No human moderator. No manual review. The AI fetches the proof URL, verifies the amount, currency, recipient, and transaction ID — then releases funds automatically.

---

## Contract

| File | Purpose |
|---|---|
| `contracts/p2p_escrow.py` | Full trade lifecycle, offer board, AI arbitration |

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
- **AI proof verification** — the AI reads the actual payment screenshot URL, verifying 4 axes: transaction ID, exact amount, currency, and recipient. All 4 must pass or crypto refunds to seller
- **Offer expiry** — offers auto-expire after 24h if no buyer locks
- **Timeouts** — buyer has 1h to pay, seller has 30min to release after proof is submitted
- **Supported tokens** — GEN (native)

### Settlement paths (all covered by tests)

| Path | Trigger | Outcome |
|---|---|---|
| `cancel_offer` | Seller cancels before buyer | Crypto → seller |
| `release_crypto` | Seller confirms payment | Crypto → buyer |
| `cancel_expired_order` | Buyer never pays | Crypto → seller |
| `arbitrate` (release) | AI confirms valid proof | Crypto → buyer |
| `arbitrate` (refund) | AI rejects proof | Crypto → seller |
| `expire_offer` | No buyer in 24h | Crypto → seller |

---

## Deploy

```
1. Deploy p2p_escrow.py in GenLayer Studio
   → no constructor arguments needed
   → note the contract address
```

No external contract dependencies — standalone, no setup steps after deploy.

---

## Frontend

React + Vite dApp that connects directly to the deployed contract via `genlayer-js`. Supports Rabby and MetaMask wallets.

### Setup

```bash
cd frontend
cp .env.example .env
# fill in your deployed contract address in .env

npm install
npm run dev
```

### .env

```env
VITE_P2P_ESCROW_ADDRESS=0x...    # your deployed P2PEscrow address
```

### Pages / Tabs

| Tab | Role | Action |
|---|---|---|
| 1. Sell Crypto | Seller | Post offer, lock crypto |
| 2. Lock Order | Buyer | Commit to trade (AI rate check) |
| 3. Submit Proof | Buyer | Mark paid + upload screenshot URL |
| 4. Release | Seller | Release or dispute |
| 5. AI Arbiter | Anyone | Trigger AI arbitration |

---

## Tests

25/25 passing — all settlement paths covered.

```bash
pip install genlayer-test pytest --pre
python -m pytest tests/test_p2p_escrow.py -v
```

---

## Planned upgrades

- [ ] ERC-20 / USDT support
- [ ] On-chain trader reputation system
- [ ] Appeal layer for high-value disputes
- [ ] Offer board with multiple simultaneous offers

---

## Built on

- [GenLayer](https://genlayer.com) — Intelligent Contracts with AI consensus
- [genlayer-js](https://github.com/yeagerai/genlayer-js) — JavaScript SDK
- React + Vite
