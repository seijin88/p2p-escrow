"""
Tests for P2PEscrow — all settlement paths.
Uses gltest direct mode: direct_vm, direct_deploy, direct_alice/bob/charlie.

The escrow's profile gate is wired at deploy time by the `direct_deploy` fixture
in conftest.py, and native payouts are recorded by its transfer ledger instead
of being executed — see conftest.py for both doubles.

Run:
    python -m pytest tests/test_p2p_escrow.py -v
"""

CONTRACT_PATH         = "contracts/p2p_escrow.py"
PROFILE_CONTRACT_PATH = "contracts/user_profile.py"

CRYPTO_AMOUNT = 10 ** 18
FIAT_AMOUNT   = 15000
RATE          = 15000          # IDR per 1 GEN
MARKET_PRICE  = 15000.0        # same as RATE → 0% deviation
PROOF_URL     = "https://example.com/proof.png"


import json
from datetime import datetime, timezone

from conftest import address_bytes, address_hex


# ── Address helper ─────────────────────────────────────────────────────────────

def addr_hex(a):
    """Convert address bytes to 0x hex (matches the contract's str(address))."""
    if isinstance(a, (bytes, bytearray)):
        return "0x" + a.hex()
    return str(a)


# ── Helpers ───────────────────────────────────────────────────────────────────

def post_offer(vm, contract, seller, fiat="IDR", rate=RATE):
    vm.sender = seller
    vm.value  = CRYPTO_AMOUNT
    oid = contract.post_offer("GEN", fiat, FIAT_AMOUNT, rate, "BCA, GoPay")
    vm.value = 0
    return oid

def mock_market(vm, price=MARKET_PRICE, fiat="idr"):
    """Mock the price oracle the contract reads (CoinGecko simple-price JSON).

    The offer's rate is `<fiat> per 1 GEN`, so the oracle must be asked in that
    same fiat — the contract builds the URL from the offer's currency.
    """
    vm.mock_web(
        "api.coingecko.com",
        {"status": 200, "body": json.dumps({"genlayer": {fiat: price}})},
    )

def mock_market_broken(vm):
    """Oracle returns something unparseable (outage / captcha page)."""
    vm.mock_web("api.coingecko.com", {"status": 200, "body": "<html>rate limited</html>"})

def mock_rate(vm, within_limit=True):
    """Market price that is inside (default) or outside the ±10% band."""
    mock_market(vm, price=MARKET_PRICE if within_limit else MARKET_PRICE * 1.5)

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
    """Check trade is settled with expected verdict."""
    t = contract.get_trade(trade_id)
    assert t["status"]  == "settled", f"Expected settled, got {t['status']}"
    assert t["verdict"] == expected_verdict, f"Expected {expected_verdict}, got {t['verdict']}"


def assert_payout(transfers, recipient, amount=CRYPTO_AMOUNT, count=1):
    """Settlement check: the contract sent native GEN to `recipient`.

    `transfers` is conftest's ledger; it records the contract's real
    `emit_transfer(value=...)` calls, i.e. what actually moves on-chain.
    """
    got = transfers.total(recipient)
    assert got == amount, f"Expected {amount} to {addr_hex(recipient)}, ledger has {got}"
    assert len(transfers.recipients()) == count, (
        f"Expected exactly {count} payout(s), ledger has {transfers.entries}"
    )


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

def test_cancel_offer_returns_crypto_to_seller(direct_vm, direct_deploy, direct_alice, transfers):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_alice
    contract.cancel_offer(oid)
    assert contract.get_offer(oid)["status"] == "cancelled"
    assert_payout(transfers, direct_alice)

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
    """Quoted rate 50% above market must be rejected by the ±10% guard."""
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    mock_market(direct_vm, price=MARKET_PRICE * 1.5)
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

def test_release_crypto_sends_to_buyer(direct_vm, direct_deploy, direct_alice, direct_bob, transfers):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    direct_vm.sender = direct_alice
    contract.release_crypto(tid)
    assert_settled(contract, tid, "release")
    assert_payout(transfers, direct_bob)

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

def test_cancel_expired_order_refunds_seller(direct_vm, direct_deploy, direct_alice, direct_bob, transfers):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    direct_vm.warp("2027-01-01T02:00:00")
    direct_vm.sender = direct_alice
    contract.cancel_expired_order(tid)
    assert_settled(contract, tid, "refund")
    assert_payout(transfers, direct_alice)

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

def test_arbitrate_release_sends_to_buyer(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, transfers):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    mock_arb(direct_vm, "release")
    direct_vm.sender = direct_charlie
    contract.arbitrate(tid)
    assert_settled(contract, tid, "release")
    assert_payout(transfers, direct_bob)

def test_arbitrate_refund_returns_to_seller(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, transfers):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    tid = lock_order(direct_vm, contract, direct_bob, oid)
    mark_paid(direct_vm, contract, direct_bob, tid)
    open_dispute(direct_vm, contract, direct_alice, tid)
    mock_arb(direct_vm, "refund")
    direct_vm.sender = direct_charlie
    contract.arbitrate(tid)
    assert_settled(contract, tid, "refund")
    assert_payout(transfers, direct_alice)

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

def test_expire_offer_returns_crypto_to_seller(direct_vm, direct_deploy, direct_alice, direct_bob, transfers):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.warp("2027-01-02T02:00:00")
    direct_vm.sender = direct_bob
    contract.expire_offer(oid)
    assert contract.get_offer(oid)["status"] == "expired"
    assert_payout(transfers, direct_alice)

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
# FIX 2 — ENFORCE REPORTED PROFILES (inside the escrow)
#
# The escrow keeps its own registry: `report_profile` writes the caller's bank
# details, and every trading entry point requires them. The trading path reads no
# other contract at all, so the gate cannot be bypassed through a misconfigured
# registry and there is no second source of truth to diverge from. conftest
# reports profiles for the standard traders at deploy time; `dave` below stands
# for an address that never reported.
# ══════════════════════════════════════════════════════════════════════════════

DAVE = address_hex("dave")


def test_unreported_address_cannot_open_offer(direct_vm, direct_deploy, direct_alice):
    """An address that never reported a profile cannot post an offer."""
    escrow = direct_deploy(CONTRACT_PATH)
    assert escrow.is_profile_reported(DAVE) is False
    assert escrow.get_profile(DAVE) is None

    direct_vm.sender = address_bytes("dave")
    direct_vm.value  = CRYPTO_AMOUNT
    with direct_vm.expect_revert("Profile report required"):
        escrow.post_offer("GEN", "IDR", FIAT_AMOUNT, RATE, "BCA, GoPay")
    direct_vm.value = 0


def test_unreported_buyer_cannot_lock_order(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """The gate covers locking too, not only posting."""
    escrow = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, escrow, direct_alice)      # alice has reported

    direct_vm.sender = address_bytes("dave")
    mock_rate(direct_vm)
    with direct_vm.expect_revert("Profile report required"):
        escrow.lock_order(oid)


def test_profile_report_is_written_for_the_caller_only(
    direct_vm, direct_deploy, direct_alice
):
    """report_profile keys on the caller, so nobody can report for someone else."""
    escrow = direct_deploy(CONTRACT_PATH)

    direct_vm.sender = direct_alice
    escrow.report_profile("BCA", "1234567890", "Alice Seller")

    alice = escrow.get_profile(address_hex("alice"))
    assert alice["account_name"] == "Alice Seller"
    assert alice["address"].lower() == address_hex("alice")
    # alice's call created exactly one entry, and dave still has none
    assert escrow.is_profile_reported(DAVE) is False


def test_report_profile_rejects_incomplete_details(direct_vm, direct_deploy, direct_alice):
    """Bank details must be filled in; junk profiles are not storable."""
    escrow = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    for bank, number, name, expected in (
        ("",         "12345678", "Alice", "Bank name required"),
        ("BCA",      "",         "Alice", "Account number required"),
        ("BCA",      "12345678", "",      "Account name required"),
        ("BCA",      "123",      "Alice", "Account number required"),
        ("B" * 200,  "12345678", "Alice", "Profile field too long"),
    ):
        with direct_vm.expect_revert(expected):
            escrow.report_profile(bank, number, name)


def test_trade_keeps_the_profile_snapshot_the_buyer_committed_to(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """The details a trade settles against are the ones posted, not the newest ones.

    The window that matters is between `post_offer` and `lock_order`: if the
    seller switches bank account there, the trade must still carry the details
    the buyer saw when committing — otherwise the arbiter would verify a proof
    against an account the buyer never agreed to.
    """
    escrow = direct_deploy(CONTRACT_PATH)

    direct_vm.sender = direct_alice
    escrow.report_profile("BCA", "11111111", "Alice First")
    oid = post_offer(direct_vm, escrow, direct_alice)
    assert escrow.get_offer(oid)["account_name"] == "Alice First"

    # alice switches bank account BEFORE the buyer locks
    direct_vm.sender = direct_alice
    escrow.report_profile("GoPay", "22222222", "Alice Second")
    assert escrow.get_profile(address_hex("alice"))["bank_name"] == "GoPay"

    # the trade keeps what the offer carried when it was posted
    tid = lock_order(direct_vm, escrow, direct_bob, oid)
    assert escrow.get_trade(tid)["seller_account_name"] == "Alice First"
    assert escrow.get_trade(tid)["seller_bank_name"]    == "BCA"

    # and after settlement the snapshot is unchanged
    mark_paid(direct_vm, escrow, direct_bob, tid)
    direct_vm.sender = direct_alice
    escrow.release_crypto(tid)
    assert escrow.get_trade(tid)["seller_account_name"] == "Alice First"

    # a new offer, meanwhile, carries the new details
    oid2 = post_offer(direct_vm, escrow, direct_alice)
    assert escrow.get_offer(oid2)["account_name"] == "Alice Second"
    assert escrow.get_offer(oid2)["bank_name"]    == "GoPay"


def test_profile_contract_pointer_does_not_gate_trading(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """The admin pointer is informational — a bogus address cannot affect trading.

    The owner points it at an address that is not a profile contract at all.
    Trading still works off the locally reported profiles, and the escrow makes
    no cross-contract read: conftest's proxy raises if one is ever attempted.
    """
    direct_vm.sender = direct_alice          # alice deploys = alice is owner
    escrow = direct_deploy(CONTRACT_PATH)

    bogus = "0x" + "deadbeef" * 5
    direct_vm.sender = direct_alice
    escrow.set_user_profile_contract(bogus)
    assert escrow.get_user_profile_contract().lower() == bogus

    oid = post_offer(direct_vm, escrow, direct_alice)
    tid = lock_order(direct_vm, escrow, direct_bob, oid)
    assert escrow.get_trade(tid)["status"] == "active"


def test_reported_traders_can_complete_full_trade(
    direct_vm, direct_deploy, direct_alice, direct_bob, transfers
):
    """Traders who reported run the whole lifecycle, and the trade carries their details."""
    escrow = direct_deploy(CONTRACT_PATH)

    direct_vm.sender = direct_alice
    escrow.report_profile("BCA",   "1234567890",   "Alice Seller")
    direct_vm.sender = direct_bob
    escrow.report_profile("GoPay", "081234567890", "Bob Buyer")

    oid = post_offer(direct_vm, escrow, direct_alice)
    tid = lock_order(direct_vm, escrow, direct_bob, oid)

    t = escrow.get_trade(tid)
    assert t["status"] == "active"
    # Bank details on the trade come from the reports made on this escrow
    assert t["seller_account_name"]   == "Alice Seller"
    assert t["seller_bank_name"]      == "BCA"
    assert t["seller_account_number"] == "1234567890"
    assert t["buyer_account_name"]    == "Bob Buyer"
    assert t["buyer_bank_name"]       == "GoPay"

    mark_paid(direct_vm, escrow, direct_bob, tid)
    direct_vm.sender = direct_alice
    escrow.release_crypto(tid)
    assert_settled(escrow, tid, "release")
    assert_payout(transfers, direct_bob)


def test_timestamps_come_from_the_transaction_clock(
    direct_vm, direct_deploy, direct_alice
):
    """Deadlines derive from the transaction time, not from another clock.

    GenVM wires the stdlib clock to the transaction timestamp, so time is
    identical for every validator (docs: Transaction Context → Time and
    Timestamps). gltest mirrors that by pointing `datetime.now()` at the value
    `warp()` sets, which is what this asserts — a contract reading some other
    clock would miss the warped value.
    """
    escrow = direct_deploy(CONTRACT_PATH)

    direct_vm.warp("2030-05-05T05:05:05Z")
    oid = post_offer(direct_vm, escrow, direct_alice)

    expected = int(datetime(2030, 5, 5, 5, 5, 5, tzinfo=timezone.utc).timestamp())
    o = escrow.get_offer(oid)
    assert o["created_at"] == expected
    assert o["expires_at"] == expected + 24 * 3600   # OFFER_EXPIRY

    # windows move with the transaction clock, and only with it
    direct_vm.warp("2030-05-06T05:05:06Z")
    direct_vm.sender = direct_alice
    escrow.expire_offer(oid)
    assert escrow.get_offer(oid)["status"] == "expired"


# ══════════════════════════════════════════════════════════════════════════════
# FIX 3 — TOKEN & RATE RULES MATCH SETTLEMENT
# ══════════════════════════════════════════════════════════════════════════════

def test_only_gen_token_is_accepted(direct_vm, direct_deploy, direct_alice):
    """Only GEN is in SUPPORTED_TOKENS; any other string must be rejected."""
    # Deployed once: gltest direct mode allows only one deployment of a given
    # contract class per test. The guard runs before any state is touched, so
    # reusing the instance across the loop is equivalent.
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    for bad_token in ["USDT", "ETH", "BTC", "USDC"]:
        direct_vm.value = CRYPTO_AMOUNT
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


def test_offer_rejects_fiat_the_oracle_cannot_price(
    direct_vm, direct_deploy, direct_alice
):
    """Only fiats we can price GEN in may be offered (rate guard needs them)."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    for bad_fiat in ["EUR", "JPY", "XX"]:
        direct_vm.value = CRYPTO_AMOUNT
        with direct_vm.expect_revert("Unsupported fiat currency"):
            contract.post_offer("GEN", bad_fiat, FIAT_AMOUNT, RATE, "BCA")
        direct_vm.value = 0


def test_offer_normalises_token_and_fiat_case(direct_vm, direct_deploy, direct_alice):
    """`gen`/`idr` from the UI must be stored as GEN/IDR, not rejected."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value  = CRYPTO_AMOUNT
    oid = contract.post_offer("gen", "idr", FIAT_AMOUNT, RATE, "BCA, GoPay")
    direct_vm.value = 0
    o = contract.get_offer(oid)
    assert o["token"]         == "GEN"
    assert o["fiat_currency"] == "IDR"


def test_lock_order_records_market_price_and_deviation(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """The locked trade must carry the price it was checked against.

    Rate is `<fiat> per 1 GEN`, so the oracle is asked for that same fiat and
    the stored deviation is what the ±10% rule actually compared.
    """
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    mock_market(direct_vm, price=16500.0)   # 10% above the 15000 quote
    tid = contract.lock_order(oid)

    t = contract.get_trade(tid)
    assert int(t["market_price_micro_at_lock"]) == 16500 * 10 ** 6
    # deviation is measured against the market price: |15000-16500|/16500 = 9%
    assert t["rate_deviation_pct"] == 9
    assert t["rate"] == str(RATE)


def test_rate_oracle_is_asked_in_the_offer_currency(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """A USD offer must be priced in USD — not against a hardcoded IDR page."""
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice, fiat="USD", rate=100)

    direct_vm.sender = direct_bob
    # Only the USD flavour of the oracle call is mocked: if the contract asked
    # for anything else (or for nothing) the lookup fails and lock_order reverts.
    direct_vm.mock_web(
        "vs_currencies=usd",
        {"status": 200, "body": json.dumps({"genlayer": {"usd": 100.0}})},
    )
    tid = contract.lock_order(oid)
    t = contract.get_trade(tid)
    assert t["fiat_currency"] == "USD"
    assert int(t["market_price_micro_at_lock"]) == 100 * 10 ** 6


def test_rate_check_fails_closed_when_oracle_is_unavailable(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """An unreadable oracle must abort the trade, not wave the rate through."""
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    mock_market_broken(direct_vm)
    with direct_vm.expect_revert("Market rate unavailable"):
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


def test_arbitration_fails_closed_on_unreadable_response(
    direct_vm, direct_deploy, direct_alice, direct_bob, transfers
):
    """A model reply that is not the required JSON object must refund, not crash."""
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    direct_vm.mock_web("example.com/proof.png", {"status": 200, "body": "Transfer Rp15000 TXN123"})
    direct_vm.mock_llm("AI arbiter", "Sorry, I cannot read this screenshot.")
    contract.arbitrate(tid)

    t = contract.get_trade(tid)
    assert t["verdict"] == "refund"
    assert "failed" in t["verdict_reason"].lower()
    assert_payout(transfers, direct_alice)


# ── Validators: every payout-affecting field must be compared ─────────────────
#
# Direct mode captures the validator instead of running it, and `run_validator`
# then calls it with the leader's result — including a tampered one. These tests
# prove the comparison covers every field that can decide the payout: a
# validator that only looked at `verdict` would pass the first case below and
# fail the rest.

def test_arbitration_validator_compares_every_axis(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    tid = _disputed_trade(direct_vm, contract, direct_alice, direct_bob)
    _arb_mock(direct_vm)          # leader and validator both see all-True
    contract.arbitrate(tid)       # captures the arbitration validator

    agreeing = {
        "verdict": "release", "reason": "ok",
        "tx_id_found": True, "amount_matches": True, "currency_matches": True,
        "recipient_matches": True, "payment_method_valid": True,
    }
    assert direct_vm.run_validator(leader_result=agreeing) is True

    for axis in ("verdict", "tx_id_found", "amount_matches",
                 "currency_matches", "recipient_matches", "payment_method_valid"):
        tampered = dict(agreeing)
        tampered[axis] = "refund" if axis == "verdict" else False
        assert direct_vm.run_validator(leader_result=tampered) is False, (
            f"arbitration validator ignored a differing '{axis}'"
        )


def test_rate_validator_compares_every_rate_field(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    oid = post_offer(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_bob
    mock_rate(direct_vm)
    contract.lock_order(oid)      # captures the rate validator

    market_micro = int(MARKET_PRICE * 10 ** 6)
    agreeing = {"market_micro": market_micro, "deviation_pct": 0, "within_limit": True}
    assert direct_vm.run_validator(leader_result=agreeing) is True

    for field, tampered_value in (
        ("within_limit", False),
        ("market_micro", market_micro + 10 ** 6),
        ("deviation_pct", 7),
    ):
        tampered = dict(agreeing)
        tampered[field] = tampered_value
        assert direct_vm.run_validator(leader_result=tampered) is False, (
            f"rate validator ignored a differing '{field}'"
        )
