# Submission Package — GenLayer P2P Escrow

## Summary (≤1000 chars)

P2P escrow on GenLayer fixed per the 4 reviewer requirements. (1) Registration: a `register()` gate with no private data and no admin keys — each address can only register itself; create_offer/lock_order reject unregistered addresses. (2) Settlement = display: transfers move exactly the locked amount and rate, with no hidden conversion. (3) Arbitration validators only compare the payout-deciding field (`approved`); reason does not affect payout. (4) Photo proof goes to vision AI with `response_format=json` and defensive parsing. All errors use `gl.vm.UserError`; release/force are single-use (no doubles); proof upload is buyer-only; cancel refunds the seller; the seller statement is stored on-chain for the AI. 17 direct-mode tests pass; the full flow is verified on Bradbury.

## Test evidence (`tests/test_studio_escrow.py`, gltest direct mode)

```text
17 passed in 0.88s
- test_create_offer_rejects_zero_value
- test_create_offer_rejects_unsupported_token_and_fiat
- test_create_offer_sets_24h_expiry
- test_lock_rejects_seller_buying_own_offer
- test_lock_rejects_expired_offer
- test_proof_upload_is_buyer_only
- test_release_settles_exact_locked_amount
- test_release_cannot_run_twice
- test_force_release_is_owner_only_and_single_use
- test_cancel_marks_cancelled
- test_arbitrate_approve_releases
- test_arbitrate_reject_refunds
- test_arbitrate_validator_compares_approved_field
- test_arbitrate_rejects_bad_note
- test_register_marks_address
- test_unregistered_seller_cannot_offer
- test_unregistered_buyer_cannot_lock
```

Contract: `contracts/p2p_escrow_studio.py` (12,723 bytes, fits deploy limits).

## On-chain evidence (Bradbury, base https://explorer-bradbury.genlayer.com/tx/)

Deployed contract: `0x004ccDB463A90698b443F0e54b736485618473aB`

| Path | Tx |
|---|---|
| force_release (owner) → buyer got 1 GEN | `0x70b06c7ed318bd828e44874a5f35c553b1f01cf1a08c9f4014b63f3facd8f8cb` |
| release_crypto (non-owner seller) → buyer got 1 GEN | `0x26db082a59d94c993d17439942788e4b5afcdea0ef5c707a5f5134c9d700dcab` |
| cancel_offer → status cancelled, funds back | `0x22acdf331ef0f02b6e8841c1b8137a13a56e8650641989ceffa55d452af31586` |
| arbitrate_ai → refund to seller (generic receipt rejected by AI) | `0x351d82bd3be0de36f149ee866a0e02d24915d425dc6f057c8db303033d505a3d` |
| arbitrate_ai → approve (valid Rp150k DANA receipt) → status released | `0xad9b7c054df6e011e4367770e3f9cf62a7531031916a1df2a8e0a786239a6908` |
| Negative: set_proof_url on missing ID → `trade not found` | `0x09e36cce8aa8befb50241669baabb00aaba90ca8ac857b8e1a115ecdf18ce176` |
| Negative: album link proof → exit 1, then closed by image guard | `0x0de6406dc1dc0efa5d39f21a764ce1d5975fbefea8b33030bfcf63c870305003` |

Frontend: `frontend/` (Vite+React, build passes) targets the studio contract API.
