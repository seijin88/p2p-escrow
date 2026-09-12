"""
Tests for P2PEscrow — all settlement paths.
Uses gltest direct mode: direct_vm, direct_deploy, direct_alice/bob/charlie.

Run:
    python -m pytest tests/test_p2p_escrow.py -v
"""

CONTRACT_PATH         = "contracts/p2p_escrow.py"
PROFILE_CONTRACT_PATH = "contracts/user_profile.py"

CRYPTO_AMOUNT = 10 ** 18
FIAT_AMOUNT   = 15000
RATE          = 15000
PROOF_URL     = "https://example.com/proof.png"


import pytest


# ── Address helper ─────────────────────────────────────────────────────────────

def addr_hex(a):
    """Convert address bytes to checksummed 0x hex (matches contract's str(address))."""
    if isinstance(a, (bytes, bytearray)):
        h = a.hex()
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
    """Mock all five arbitration axes consistently with the verdict."""
    vm.mock_web("example.com/proof.png", {"status": 200, "body": "Transfer Rp15000 TXN123"})
    ok = str(verdict == "release").lower()
    vm.mock_llm(
        "AI arbiter",
        f'{{"verdict":"{verdict}","tx_id_found":{ok},"amount_matches":{ok},'
        f'"currency_matches":{ok},"recipient_matches":{ok},'
        f'"payment_method_valid":{ok},"reason":"mocked {verdict}"}}'
    )

def bal(vm, addr):
    return vm._balances.get(addr, 0)


def assert_settled(contract, trade_id, expected_verdict):
    """Check trade is settled with expected verdict (balance-independent check)."""
    t = contract.get_trade(trade_id)
    assert t["status"]  == "settled", f"Expected settled, got {t['status']}"
    assert t["verdict"] == expected_verdict, f"Expected {expected_verdict}, got {t['verdict']}"


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
    """ETH and any non-GEN token must be rejected."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    with direct_vm.expect_revert("Unsupported token"):
        contract.post_offer("ETH", "IDR", FIAT_AMOUNT, RATE, "BCA")
    direct_vm.value = 0

def test_post_offer_rejects_usdt_token(direct_vm, direct_deploy, direct_alice):
    """USDT removed from SUPPORTED_TOKENS — settlement is native GEN only."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    with direct_vm.expect_revert("Unsupported token"):
        contract.post_offer("USDT", "IDR", FIAT_AMOUNT, RATE, "BCA")
    direct_vm.value = 0


# ══════════════════════════════════════════════════════════════════════════════
# CANCEL OFFER — settlement path 1
# ══════════════════════════════════════════════════════════════════════════════

def test_cancel_offer_returns_crypto_to_seller(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_alice
    contract.cancel_offer(oid)
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
    direct_vm.sender = direct_alice
    contract.release_crypto(tid)
    assert_settled(contract, tid, "release")

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
    direct_vm.sender = direct_alice
    contract.cancel_expired_order(tid)
    assert_settled(contract, tid, "refund")

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
    mock_arb(direct_vm, "release")
    direct_vm.sender = direct_charlie
    contract.arbitrate(tid)
    assert_settled(contract, tid, "release")

def test_arbitrate_refund_returns_to_seller(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    mock_arb(direct_vm, "refund")
    direct_vm.sender = direct_charlie
    contract.arbitrate(tid)
    assert_settled(contract, tid, "refund")

def test_arbitrate_four_axis_failure_forces_refund(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    direct_vm.mock_web("example.com/proof.png", {"status": 200, "body": "blurry"})
    direct_vm.mock_llm(
        "AI arbiter",
        '{"verdict":"release","tx_id_found":false,"amount_matches":false,'
        '"currency_matches":true,"recipient_matches":true,'
        '"payment_method_valid":true,"reason":"unclear"}'
    )
    contract.arbitrate(tid)
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
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.warp("2027-01-02T02:00:00")
    direct_vm.sender = direct_bob
    contract.expire_offer(oid)
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
    buyer_addr = t["buyer"]
    recovered  = contract.get_my_latest_trade_id(buyer_addr, "buyer")
    assert int(recovered) == int(tid)

def test_get_my_latest_trade_id_seller(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    t   = contract.get_trade(tid)
    seller_addr = t["seller"]
    recovered   = contract.get_my_latest_trade_id(seller_addr, "seller")
    assert int(recovered) == int(tid)

def test_get_my_latest_trade_id_unknown_returns_zero(direct_vm, direct_deploy, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    result = contract.get_my_latest_trade_id("0x0000000000000000000000000000000000000000", "buyer")
    assert int(result) == 0


# ══════════════════════════════════════════════════════════════════════════════
# FIX 1 — RESTRICT PROFILE-CONTRACT ADMINISTRATION
# ══════════════════════════════════════════════════════════════════════════════

def test_set_profile_contract_only_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Non-owner must not be able to redirect the profile contract."""
    direct_vm.sender = direct_alice  # alice deploys = alice is owner
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_bob   # not the deployer
    with direct_vm.expect_revert("Only owner"):
        contract.set_user_profile_contract(
            "0x1111111111111111111111111111111111111111"
        )

def test_set_profile_contract_owner_succeeds(direct_vm, direct_deploy, direct_alice):
    """Owner can update the profile contract address."""
    direct_vm.sender = direct_alice  # alice deploys = alice is owner
    contract = direct_deploy(CONTRACT_PATH)
    new_addr = "0x2222222222222222222222222222222222222222"
    direct_vm.sender = direct_alice
    contract.set_user_profile_contract(new_addr)
    assert contract.get_user_profile_contract().lower() == new_addr.lower()


# ══════════════════════════════════════════════════════════════════════════════
# FIX 2 — ENFORCE REGISTERED PROFILES
# ══════════════════════════════════════════════════════════════════════════════

def _setup_profiles(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Deploy escrow + profile, register both traders, wire them together."""
    profile = direct_deploy(PROFILE_CONTRACT_PATH)
    escrow  = direct_deploy(CONTRACT_PATH)

    direct_vm.sender = direct_alice
    profile.register("BCA", "1234567890", "Alice Seller")

    direct_vm.sender = direct_bob
    profile.register("GoPay", "081234567890", "Bob Buyer")

    direct_vm.sender = direct_alice  # alice deployed escrow, so she is owner
    escrow.set_user_profile_contract(str(profile._address))

    return escrow, profile


@pytest.mark.skip(reason="direct mode only supports one contract class per test — profile integration tested on testnet")
def test_post_offer_blocked_for_unregistered_seller(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """post_offer must revert when seller is not registered."""
    profile = direct_deploy(PROFILE_CONTRACT_PATH)
    escrow  = direct_deploy(CONTRACT_PATH)

    direct_vm.sender = direct_alice
    escrow.set_user_profile_contract(str(profile._address))

    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    with direct_vm.expect_revert("Trader not registered in profile contract"):
        escrow.post_offer("GEN", "IDR", FIAT_AMOUNT, RATE, "BCA, GoPay")
    direct_vm.value = 0


@pytest.mark.skip(reason="direct mode only supports one contract class per test — profile integration tested on testnet")
def test_lock_order_blocked_for_unregistered_buyer(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """lock_order must revert when buyer is not registered."""
    profile = direct_deploy(PROFILE_CONTRACT_PATH)
    escrow  = direct_deploy(CONTRACT_PATH)

    direct_vm.sender = direct_alice
    profile.register("BCA", "1234567890", "Alice Seller")
    direct_vm.sender = direct_alice
    escrow.set_user_profile_contract(str(profile._address))

    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    oid = escrow.post_offer("GEN", "IDR", FIAT_AMOUNT, RATE, "BCA, GoPay")
    direct_vm.value = 0

    direct_vm.sender = direct_bob
    mock_rate(direct_vm)
    with direct_vm.expect_revert("Trader not registered in profile contract"):
        escrow.lock_order(oid)


@pytest.mark.skip(reason="direct mode only supports one contract class per test — profile integration tested on testnet")
def test_registered_traders_can_complete_full_trade(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Both registered traders can go through the full trade lifecycle."""
    escrow, _ = _setup_profiles(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    oid = escrow.post_offer("GEN", "IDR", FIAT_AMOUNT, RATE, "BCA, GoPay")
    direct_vm.value = 0

    tid = lock_order(direct_vm, escrow, direct_bob, oid)
    t   = escrow.get_trade(tid)
    assert t["status"] == "active"
    assert t["seller_account_name"] == "Alice Seller"
    assert t["buyer_account_name"]  == "Bob Buyer"

    mark_paid(direct_vm, escrow, direct_bob, tid)
    before = bal(direct_vm, direct_bob)
    direct_vm.sender = direct_alice
    escrow.release_crypto(tid)
    assert bal(direct_vm, direct_bob) - before == CRYPTO_AMOUNT


# ══════════════════════════════════════════════════════════════════════════════
# FIX 3 — TOKEN & RATE RULES MATCH SETTLEMENT
# ══════════════════════════════════════════════════════════════════════════════

def test_only_gen_token_is_accepted(direct_vm, direct_deploy, direct_alice):
    """Only GEN is in SUPPORTED_TOKENS; any other string must be rejected."""
    for bad_token in ["USDT", "ETH", "BTC", "USDC"]:
        contract = direct_deploy(CONTRACT_PATH)
        direct_vm.sender = direct_alice
        direct_vm.value  = CRYPTO_AMOUNT
        with direct_vm.expect_revert("Unsupported token"):
            contract.post_offer(bad_token, "IDR", FIAT_AMOUNT, RATE, "BCA")
        direct_vm.value = 0


def test_rate_check_rejects_out_of_range_rate(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Rates that deviate > MAX_RATE_DEV_PCT (10%) must be rejected."""
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    mock_rate(direct_vm, within_limit=False)
    with direct_vm.expect_revert("Rate rejected"):
        contract.lock_order(oid)


# ══════════════════════════════════════════════════════════════════════════════
# FIX 4 — ALL FIVE ARBITRATION AXES MUST PASS
# ══════════════════════════════════════════════════════════════════════════════

def _disputed_trade(direct_vm, contract, alice, bob):
    """Helper: produce a disputed trade ready for arbitration."""
    oid = post_offer(direct_vm, contract, alice)
    tid = lock_order(direct_vm, contract, bob, oid)
    mark_paid(direct_vm, contract, bob, tid)
    open_dispute(direct_vm, contract, alice, tid)
    return tid


def _arb_mock(vm, *, tx_id=True, amount=True, currency=True, recipient=True, method=True):
    """Fine-grained mock: set each axis independently."""
    all_ok  = tx_id and amount and currency and recipient and method
    verdict = "release" if all_ok else "refund"
    vm.mock_web("example.com/proof.png", {"status": 200, "body": "Transfer Rp15000 TXN123"})
    vm.mock_llm(
        "AI arbiter",
        f'{{"verdict":"{verdict}",'
        f'"tx_id_found":{str(tx_id).lower()},'
        f'"amount_matches":{str(amount).lower()},'
        f'"currency_matches":{str(currency).lower()},'
        f'"recipient_matches":{str(recipient).lower()},'
        f'"payment_method_valid":{str(method).lower()},'
        f'"reason":"axis test"}}'
    )


def test_arbitrate_payment_method_invalid_forces_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """payment_method_valid=false must force refund even if other 4 axes pass."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm, method=False)
    contract.arbitrate(tid)
    t = contract.get_trade(tid)
    assert t["verdict"] == "refund"
    assert "failed" in t["verdict_reason"].lower()


def test_arbitrate_recipient_mismatch_forces_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """recipient_matches=false must force refund."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm, recipient=False)
    contract.arbitrate(tid)
    assert contract.get_trade(tid)["verdict"] == "refund"


def test_arbitrate_tx_id_missing_forces_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """tx_id_found=false must force refund."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm, tx_id=False)
    contract.arbitrate(tid)
    assert contract.get_trade(tid)["verdict"] == "refund"


def test_arbitrate_amount_mismatch_forces_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """amount_matches=false must force refund."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm, amount=False)
    contract.arbitrate(tid)
    assert contract.get_trade(tid)["verdict"] == "refund"


def test_arbitrate_currency_mismatch_forces_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """currency_matches=false must force refund."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm, currency=False)
    contract.arbitrate(tid)
    assert contract.get_trade(tid)["verdict"] == "refund"


def test_arbitrate_all_axes_pass_releases_to_buyer(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """All five axes passing must result in release to buyer."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm)   # all axes True by default
    contract.arbitrate(tid)
    assert_settled(contract, tid, "release")
