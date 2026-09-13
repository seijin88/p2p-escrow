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

- **Rate guard** — at lock time the contract fetches the live GEN price from CoinGecko's simple-price API **in the offer's own fiat currency** and rejects quotes more than ±10% away. It is a numeric check the validators can compare field by field, not an LLM judgement: the rate is `<fiat> per 1 GEN`, so an IDR offer is priced in IDR and a USD offer in USD
- **Registered traders only** — the owner wires a `UserProfile` contract with `set_user_profile_contract`; until then, and for any address not registered in it, `post_offer` and `lock_order` revert
- **AI proof verification** — the AI reads the actual payment screenshot URL and answers on five axes: transaction ID, exact amount, currency, recipient, and payment method. All five must pass or crypto refunds to the seller, and the arbitration validator compares every one of them (plus the verdict) between leader and validators
- **Offer expiry** — offers auto-expire after 24h if no buyer locks
- **Timeouts** — buyer has 1h to pay, seller has 30min to release after proof is submitted
- **Supported tokens** — GEN (native). Only GEN can be locked and paid out, so only GEN may be offered
- **Supported fiats** — IDR, USD (the currencies the oracle can price GEN in)

### Settlement paths (each covered by tests, payouts asserted)

| Path | Trigger | Outcome |
|---|---|---|
| `cancel_offer` | Seller cancels before buyer | Crypto → seller |
| `release_crypto` | Seller confirms payment | Crypto → buyer |
| `cancel_expired_order` | Buyer never pays | Crypto → seller |
| `arbitrate` (release) | AI confirms valid proof | Crypto → buyer |
| `arbitrate` (refund) | AI rejects proof | Crypto → seller |
| `expire_offer` | No buyer in 24h | Crypto → seller |

Direct mode cannot execute native transfers, so `tests/conftest.py` installs a
ledger that records the contract's real `emit_transfer(value=...)` calls; every
settlement test asserts the recipient and the amount that moves.

---

## Deploy

```
1. Deploy p2p_escrow.py in GenLayer Studio
   → no constructor arguments needed
   → note the contract address
2. Deploy contracts/user_profile.py
3. As the escrow owner, call:
   set_user_profile_contract("<user_profile address>")
   → trading stays disabled until this is done
4. Traders register on the profile contract:
   register(bank_name, account_number, account_name)
```

The escrow itself has no compile-time dependency on the profile contract — it is
wired by the owner after deploy, and the profile contract address is the only
thing the owner can change (owner-only, enforced).

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
| 2. Lock Order | Buyer | Commit to trade (market rate check) |
| 3. Submit Proof | Buyer | Mark paid + upload screenshot URL |
| 4. Release | Seller | Release or dispute |
| 5. AI Arbiter | Anyone | Trigger AI arbitration |

---

## Tests

48 passing — every settlement path, the rate guard, the profile gate, and the
validators are covered.

```bash
pip install genlayer-test pytest --pre
python -m pytest tests/test_p2p_escrow.py -v
```

`tests/conftest.py` supplies two doubles, because gltest direct mode has no
cross-contract calls and no WASI host to move funds:

- a `UserProfile` double behind the same `gl.get_contract_at(addr).view()…`
  call path the escrow uses, so registration and the unregistered-revert paths
  are exercised rather than skipped
- a transfer ledger that records `emit_transfer(value=…)` payouts, so
  settlement tests assert who was paid and how much

---

## Planned upgrades

- [ ] ERC-20 / USDT support — needs an actual ERC-20 transfer path before it can be offered; the contract currently rejects anything but GEN rather than advertising a token it cannot settle
- [ ] Trader reputation scoring on top of the `UserProfile` registry (the registry itself ships: bank account details, used by the arbiter for recipient verification)
- [ ] Appeal layer for high-value disputes
- [ ] Offer board with multiple simultaneous offers

---

## Built on

- [GenLayer](https://genlayer.com) — Intelligent Contracts with AI consensus
- [genlayer-js](https://github.com/yeagerai/genlayer-js) — JavaScript SDK
- React + Vite
