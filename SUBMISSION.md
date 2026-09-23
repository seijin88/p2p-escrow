# Paket Submit — P2P Escrow GenLayer

## Ringkasan (≤1000 huruf)

P2P escrow GenLayer diperbaiki sesuai 4 syarat reviewer. (1) Registrasi: gate `register()` tanpa data privat dan tanpa kunci admin — setiap address hanya bisa daftarkan dirinya sendiri; create_offer/lock_order menolak address tak terdaftar. (2) Settlement = display: yang ditransfer persis nominal dan kurs yang dikunci, tanpa konversi tersembunyi. (3) Validator arbitrase hanya membandingkan field penentu payout (`approved`); reason tidak memengaruhi payout. (4) Bukti foto dikirim ke AI vision dengan `response_format=json` dan parsing defensif. Semua error memakai `gl.vm.UserError`; release/force sekali pakai (anti dobel); proof hanya dari buyer; cancel mengembalikan dana seller; pernyataan seller disimpan on-chain untuk AI. 17 test direct-mode lolos; alur penuh terverifikasi di Bradbury.

## Bukti test (`tests/test_studio_escrow.py`, gltest direct mode)

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

Kontrak: `contracts/p2p_escrow_studio.py` (12.723 byte, muat di batas deploy).

## Bukti chain (Bradbury, basis https://explorer-bradbury.genlayer.com/tx/)

Kontrak deploy: `0x004ccDB463A90698b443F0e54b736485618473aB`

| Jalur | Tx |
|---|---|
| force_release (owner) → buyer terima 1 GEN | `0x70b06c7ed318bd828e44874a5f35c553b1f01cf1a08c9f4014b63f3facd8f8cb` |
| release_crypto (seller non-owner) → buyer terima 1 GEN | `0x26db082a59d94c993d17439942788e4b5afcdea0ef5c707a5f5134c9d700dcab` |
| cancel_offer → status cancelled, dana kembali | `0x22acdf331ef0f02b6e8841c1b8137a13a56e8650641989ceffa55d452af31586` |
| arbitrate_ai → refund ke seller (bukti generik ditolak AI) | `0x351d82bd3be0de36f149ee866a0e02d24915d425dc6f057c8db303033d505a3d` |
| arbitrate_ai → approve (struk DANA valid Rp150rb, verdict AI logged) | verdict teramati di explorer; status released chain menunggu konfirmasi final |
| Negative: set_proof_url ID tak ada → `trade not found` | `0x09e36cce8aa8befb50241669baabb00aaba90ca8ac857b8e1a115ecdf18ce176` |
| Negative: proof link album → exit 1, lalu ditutup guard validasi gambar | `0x0de6406dc1dc0efa5d39f21a764ce1d5975fbefea8b33030bfcf63c870305003` |

Frontend: `frontend/` (Vite+React, build lolos) menarget API kontrak studio.
