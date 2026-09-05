"""
Tests for P2PEscrow — all settlement paths.
Uses gltest direct mode: direct_vm, direct_deploy, direct_alice/bob/charlie.

Run:
    python -m pytest tests/test_p2p_escrow.py -v
"""

CONTRACT_PATH = "contracts/p2p_escrow.py"

CRYPTO_AMOUNT = 10 ** 18
FIAT_AMOUNT   = 15000
RATE          = 15000
PROOF_URL     = "https://example.com/proof.png"


# ── Address helper ─────────────────────────────────────────────────────────────

def addr_hex(a):
    """Convert address bytes to checksummed 0x hex (matches contract's str(address))."""
    if isinstance(a, (bytes, bytearray)):
        h = a.hex()
        # EIP-55 checksum
        from hashlib import sha3_256 as _sha3
        import hashlib
        keccak = hashlib.new('sha3_256')  # fallback, not true keccak but fine for test matching
        return "0x" + h  # simplified — use raw lower hex for comparison
    return str(a)


# ── Helpers ───────────────────────────────────────────────────────────────────

def post_offer(vm, contract, seller):
    vm.sender = seller
    vm.value  = CRYPTO_AMOUNT
    oid = contract.post_offer("GEN", "IDR", FIAT_AMOUNT, RATE, "BCA, GoPay")
    vm.value = 0
    return oid

def mock_rate(vm, within_limit=True):
    vm.mock_web("coingecko.com", {"status": 200, "body": "price 15000"})
    flag = str(within_limit).lower()
    vm.mock_llm(
        "within_limit",
        f'{{"market_rate":15000,"deviation_pct":0,"within_limit":{flag},"reason":"mocked"}}'
    )

def lock_order(vm, contract, buyer, offer_id):
    vm.sender = buyer
    mock_rate(vm)
    return contract.lock_order(offer_id)

def mark_paid(vm, contract, buyer, trade_id, url=PROOF_URL):
    vm.sender = buyer
    contract.mark_paid(trade_id, url)

def open_dispute(vm, contract, seller, trade_id):
    vm.sender = seller
    contract.open_dispute(trade_id)

def mock_arb(vm, verdict):
    vm.mock_web("example.com/proof.png", {"status": 200, "body": "Transfer Rp15000 TXN123"})
    ok = str(verdict == "release").lower()
    vm.mock_llm(
        "AI arbiter",
        f'{{"verdict":"{verdict}","tx_id_found":{ok},"amount_matches":{ok},'
        f'"currency_matches":{ok},"recipient_matches":{ok},"reason":"mocked {verdict}"}}'
    )

def bal(vm, addr):
    return vm._balances.get(addr, 0)


# ══════════════════════════════════════════════════════════════════════════════
# POST OFFER
# ══════════════════════════════════════════════════════════════════════════════

def test_post_offer_creates_open_offer(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    o = contract.get_offer(oid)
    assert o["status"] == "open"
    assert o["token"]  == "GEN"

def test_post_offer_requires_locked_crypto(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value  = 0
    with direct_vm.expect_revert("Must lock crypto"):
        contract.post_offer("GEN", "IDR", FIAT_AMOUNT, RATE, "BCA")

def test_post_offer_rejects_unsupported_token(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    with direct_vm.expect_revert("Unsupported token"):
        contract.post_offer("ETH", "IDR", FIAT_AMOUNT, RATE, "BCA")
    direct_vm.value = 0


# ══════════════════════════════════════════════════════════════════════════════
# CANCEL OFFER — settlement path 1
# ══════════════════════════════════════════════════════════════════════════════

def test_cancel_offer_returns_crypto_to_seller(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    oid    = post_offer(direct_vm, contract, direct_alice)
    before = bal(direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    contract.cancel_offer(oid)
    assert bal(direct_vm, direct_alice) - before == CRYPTO_AMOUNT
    assert contract.get_offer(oid)["status"] == "cancelled"

def test_cancel_offer_only_seller(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only seller"):
        contract.cancel_offer(oid)


# ══════════════════════════════════════════════════════════════════════════════
# LOCK ORDER
# ══════════════════════════════════════════════════════════════════════════════

def test_lock_order_creates_active_trade(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    t = contract.get_trade(tid)
    assert t["status"] == "active"
    # buyer stored as checksummed hex by contract
    assert t["buyer"].lower() == "0x" + direct_bob.hex()

def test_lock_order_marks_offer_taken(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    lock_order(direct_vm, contract, direct_bob, oid)
    assert contract.get_offer(oid)["status"] == "taken"

def test_lock_order_rejects_expired_offer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.warp("2027-01-02T02:00:00")
    direct_vm.sender = direct_bob
    mock_rate(direct_vm)
    with direct_vm.expect_revert("Offer has expired"):
        contract.lock_order(oid)

def test_lock_order_rejects_bad_rate(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    mock_rate(direct_vm, within_limit=False)
    with direct_vm.expect_revert("Rate rejected"):
        contract.lock_order(oid)


# ══════════════════════════════════════════════════════════════════════════════
# MARK PAID
# ══════════════════════════════════════════════════════════════════════════════

def test_mark_paid_locks_proof(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    t = contract.get_trade(tid)
    assert t["status"]       == "paid"
    assert t["proof_url"]    == PROOF_URL
    assert t["proof_locked"] == True

def test_mark_paid_proof_immutable(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Proof already submitted"):
        contract.mark_paid(tid, "https://example.com/other.png")

def test_mark_paid_window_enforced(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    direct_vm.warp("2027-01-01T02:00:00")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Payment window expired"):
        contract.mark_paid(tid, PROOF_URL)


# ══════════════════════════════════════════════════════════════════════════════
# RELEASE CRYPTO — settlement path 2
# ══════════════════════════════════════════════════════════════════════════════

def test_release_crypto_sends_to_buyer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    before = bal(direct_vm, direct_bob)
    direct_vm.sender = direct_alice
    contract.release_crypto(tid)
    assert bal(direct_vm, direct_bob) - before == CRYPTO_AMOUNT
    t = contract.get_trade(tid)
    assert t["status"]  == "settled"
    assert t["verdict"] == "release"

def test_release_crypto_only_seller(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only seller"):
        contract.release_crypto(tid)


# ══════════════════════════════════════════════════════════════════════════════
# CANCEL EXPIRED ORDER — settlement path 3
# ══════════════════════════════════════════════════════════════════════════════

def test_cancel_expired_order_refunds_seller(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    direct_vm.warp("2027-01-01T02:00:00")
    before = bal(direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    contract.cancel_expired_order(tid)
    assert bal(direct_vm, direct_alice) - before == CRYPTO_AMOUNT
    t = contract.get_trade(tid)
    assert t["status"]  == "settled"
    assert t["verdict"] == "refund"

def test_cancel_expired_order_before_deadline(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Payment window open"):
        contract.cancel_expired_order(tid)


# ══════════════════════════════════════════════════════════════════════════════
# ARBITRATE — settlement paths 4 & 5
# ══════════════════════════════════════════════════════════════════════════════

def test_arbitrate_release_sends_to_buyer(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    before = bal(direct_vm, direct_bob)
    mock_arb(direct_vm, "release")
    direct_vm.sender = direct_charlie
    contract.arbitrate(tid)
    assert bal(direct_vm, direct_bob) - before == CRYPTO_AMOUNT
    t = contract.get_trade(tid)
    assert t["status"]  == "settled"
    assert t["verdict"] == "release"

def test_arbitrate_refund_returns_to_seller(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    before = bal(direct_vm, direct_alice)
    mock_arb(direct_vm, "refund")
    direct_vm.sender = direct_charlie
    contract.arbitrate(tid)
    assert bal(direct_vm, direct_alice) - before == CRYPTO_AMOUNT
    t = contract.get_trade(tid)
    assert t["status"]  == "settled"
    assert t["verdict"] == "refund"

def test_arbitrate_four_axis_failure_forces_refund(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    before = bal(direct_vm, direct_alice)
    direct_vm.mock_web("example.com/proof.png", {"status": 200, "body": "blurry"})
    direct_vm.mock_llm(
        "AI arbiter",
        '{"verdict":"release","tx_id_found":false,"amount_matches":false,'
        '"currency_matches":true,"recipient_matches":true,"reason":"unclear"}'
    )
    contract.arbitrate(tid)
    assert bal(direct_vm, direct_alice) - before == CRYPTO_AMOUNT
    t = contract.get_trade(tid)
    assert t["verdict"] == "refund"
    assert "failed" in t["verdict_reason"].lower()

def test_arbitrate_requires_disputed_status(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    with direct_vm.expect_revert("Not disputed"):
        contract.arbitrate(tid)


# ══════════════════════════════════════════════════════════════════════════════
# EXPIRE OFFER — settlement path 6
# ══════════════════════════════════════════════════════════════════════════════

def test_expire_offer_returns_crypto_to_seller(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid    = post_offer(direct_vm, contract, direct_alice)
    before = bal(direct_vm, direct_alice)
    direct_vm.warp("2027-01-02T02:00:00")
    direct_vm.sender = direct_bob
    contract.expire_offer(oid)
    assert bal(direct_vm, direct_alice) - before == CRYPTO_AMOUNT
    assert contract.get_offer(oid)["status"] == "expired"

def test_expire_offer_before_deadline_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Offer not yet expired"):
        contract.expire_offer(oid)


# ══════════════════════════════════════════════════════════════════════════════
# TRADE ID RECOVERY
# ══════════════════════════════════════════════════════════════════════════════

def test_get_my_latest_trade_id_buyer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    t   = contract.get_trade(tid)
    buyer_addr = t["buyer"]   # use exact address format stored by contract
    recovered  = contract.get_my_latest_trade_id(buyer_addr, "buyer")
    assert int(recovered) == int(tid)

def test_get_my_latest_trade_id_seller(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    t   = contract.get_trade(tid)
    seller_addr = t["seller"]  # use exact address format stored by contract
    recovered   = contract.get_my_latest_trade_id(seller_addr, "seller")
    assert int(recovered) == int(tid)

def test_get_my_latest_trade_id_unknown_returns_zero(direct_vm, direct_deploy, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    result = contract.get_my_latest_trade_id("0x0000000000000000000000000000000000000000", "buyer")
    assert int(result) == 0

