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
- **Trader profiles live on the escrow** — `report_profile(bank, account_number, account_name)` writes a **sha256 commitment** of those details; the plaintext bank data never touches the chain. The AI arbiter receives the LLM-extracted recipient fields and re-hashes them on-chain — only an exact match releases funds. This is **P1 (privacy)**: no one can read another trader's account number from a view call. The seller shares the plaintext off-chain (chat, QR, etc.) before payment.
- **Profile administration is owner-only and purely informational** — `set_user_profile_contract` records a `UserProfile` address for frontends to read; it never decides who may trade, so repointing it cannot let anyone in
- **AI proof verification** — the AI reads the actual payment screenshot URL and answers on five axes: transaction ID, exact amount, currency, recipient, and payment method. All five must pass or crypto refunds to the seller, and the arbitration validator compares every one of them (plus the verdict) between leader and validators
- **Offer expiry** — offers auto-expire after 24h if no buyer locks
- **Timeouts** — buyer has 1h to pay, seller has 30min to release after proof is submitted
- **Supported tokens** — GEN (native). Only GEN can be locked and paid out, so only GEN may be offered
- **Supported fiats** — IDR, USD (the currencies the oracle can price GEN in)

### Settlement paths (each covered by tests, payouts asserted after finalization)

| Path | Trigger | Outcome |
|---|---|---|
| `cancel_offer` | Seller cancels before buyer | Crypto → seller |
| `release_crypto` | Seller confirms payment | Crypto → buyer |
| `cancel_expired_order` | Buyer never pays | Crypto → seller |
| `arbitrate` (release) | AI confirms valid proof → `status = arbitrated` | Funds held during 24h appeal window |
| `appeal_verdict` | Either party appeals within window | Trade re-enters `disputed`, full re-arbitration |
| `finalize_trade` | Appeal window closed (or expired) | Crypto → buyer or seller per verdict |
| `arbitrate` (refund) | AI rejects proof | Funds held → `finalize_trade` → Crypto → seller |
| `expire_offer` | No buyer in 24h | Crypto → seller |

Direct mode cannot execute native transfers, so `tests/conftest.py` installs a
ledger that records the contract's real `emit_transfer(value=...)` calls; every
settlement test asserts the recipient and the amount that moves.

---

## Deploy

Two contract files exist, for two different jobs:

| File | What it is |
|---|---|
| `contracts/p2p_escrow.py` | the readable source — reviewed, and what the test suite runs against |
| `contracts/p2p_escrow_deploy.py` | generated, compact — **this is the file you deploy** |

The generated build exists because Bradbury rejects large deploys: 20,132 bytes
of calldata deployed successfully, while 21,892 and 32,452 bytes failed with
`status 0x0` — and the same source deploys fine on Studionet, so the code is not
the problem. The build only strips docstrings and shortens internal identifiers;
the public API and every stored field name stay exactly as written. Regenerate
and check the size before deploying:

```bash
py -3.12 scripts/make_compact_build.py   # warns when a build exceeds the ceiling
```

Then, in GenLayer Studio on Bradbury:

```
1. Deploy contracts/p2p_escrow_deploy.py
   → no constructor arguments needed
   → set the gas limit to 20,000,000 (a deploy of this size used ~14.7M)
   → note the contract address
2. Each trader reports their bank profile on the escrow:
   report_profile(bank_name, account_number, account_name)
   → offers and locks are refused until the caller has reported
```

The generated file is verified equivalent to the readable source by running the
suite against it:

```bash
cp contracts/p2p_escrow.py /tmp/p2p_escrow.readable.py
cp contracts/p2p_escrow_deploy.py contracts/p2p_escrow.py
pytest tests/test_p2p_escrow.py -q
cp /tmp/p2p_escrow.readable.py contracts/p2p_escrow.py
```

That is the whole setup: no owner step is required before trading, and no second
contract has to be deployed. The AI arbiter's recipient verification reads the
bank details the escrow snapshotted into the trade at `post_offer` / `lock_order`,
so a later `report_profile` cannot change an in-flight trade.

Optionally, the owner can point the escrow at a `UserProfile` contract
(`contracts/user_profile.py`) with `set_user_profile_contract("<address>")` for
frontends to display. It is a reference only, not a gate.

The escrow has no dependency on that pointer at all: nothing in the trading path
reads another contract, so the only thing an owner can change is a display
reference — and it cannot be used to let anyone in.

### Deployed addresses

Live on Bradbury: **`0x90706683CD68758a8b77d244421918F2FEBACE75`**, deployed from
`contracts/p2p_escrow_deploy.py` (sha256 `f3130f63…`).

`deployments/bradbury.json` records the address, transaction hash, block,
timestamp, artifact hash, and the size ceiling that shaped the build — committed
on purpose, so the address can be checked against the chain instead of trusted
from a website:

```bash
cat deployments/bradbury.json
```

Before signing anything, confirm the address your wallet is pointed at matches
the record. The frontend prints the same address in its footer for the same
reason: for an escrow, the real risk is not that the address is visible, it is
that a user is quietly pointed at some other contract.

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
VITE_P2P_ESCROW_ADDRESS=0x90706683CD68758a8b77d244421918F2FEBACE75   # see deployments/bradbury.json
VITE_USER_PROFILE_ADDRESS=0x...            # optional, display only
```

`VITE_P2P_ESCROW_ADDRESS` is required and format-checked when the app loads: if
it is missing, or is not `0x` followed by 40 hex characters, the app fails
immediately with a clear error naming the variable. There is deliberately **no
hardcoded fallback** — a stale default would send the app to an old contract
while looking like an empty board, and it would hide which address users are
actually signing against.

Traders report their bank profile straight to the escrow (`report_profile`);
the frontend reads it back with `is_profile_reported` / `get_profile` on the
same address.

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

65 passing — every settlement path, the rate guard, the profile gate, the
privacy commitment (P1), the appeal window (P2), and the validators are covered.

```bash
pip install genlayer-test pytest --pre
python -m pytest tests/test_p2p_escrow.py -v
```

`tests/conftest.py` carries two pieces of infrastructure, because gltest direct
mode has no WASI host to move funds:

- a transfer ledger that records the contract's real `emit_transfer(value=…)`
  calls, so settlement tests assert who was paid and how much — the balance
  checks this replaced had been dropped as untestable
- profile reports issued at deploy time for the fixture accounts (override the
  `reported_traders` fixture to control who may trade), which is exactly how a
  trader reports in production, so the enforcement tests exercise the real path
  rather than a mock

The profile gate needs no cross-contract stub: it is validated inside the
escrow.

---

## Planned upgrades

- [x] Appeal layer for high-value disputes — `appeal_verdict` (contract) + `appealTransaction` (GenLayer protocol-level)
- [ ] ERC-20 / USDT support — needs an actual ERC-20 transfer path before it can be offered; the contract currently rejects anything but GEN rather than advertising a token it cannot settle
- [ ] Trader reputation scoring on top of the reported profiles
- [ ] Offer board with multiple simultaneous offers

---

## Built on

- [GenLayer](https://genlayer.com) — Intelligent Contracts with AI consensus
- [genlayer-js](https://github.com/yeagerai/genlayer-js) — JavaScript SDK
- React + Vite
