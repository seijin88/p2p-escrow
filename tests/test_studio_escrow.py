"""Direct-mode tests for contracts/p2p_escrow_studio.py.

Demonstrates the reviewer-corrected paths: exact-amount settlement,
owner-only single-use force release, buyer-only proof, seller cancel
refund, and arbitration where validators compare the payout-deciding
field (approved).
"""

import json

CRYPTO = 10**18
PROOF_URL = "https://proof.example/receipt-1.png"
# PNG magic + filler; survives str -> utf-8 round-trip for the magic bytes.
PNG_BODY = "\x89PNG\r\n\x1a\n" + "A" * 128
APPROVE_JSON = '{"approved": true, "reason": "receipt matches"}'
REJECT_JSON = '{"approved": false, "reason": "no payment visible"}'


def _fund(vm, contract, amount):
    # Direct mode does not auto-credit payable value to self.balance
    # (on-chain the ghost contract does), so emulate it explicitly.
    addr = vm._contract_address
    vm.deal(addr, int(contract.get_balance()) + amount)


def _register(vm, contract, who):
    vm.sender = who
    vm.value = 0
    contract.register()


def _offer_id(vm, contract, seller, value=CRYPTO):
    _register(vm, contract, seller)
    vm.sender = seller
    vm.value = value
    oid = int(contract.create_offer("GEN", "IDR", "150000", "150000", "DANA"))
    if value:
        _fund(vm, contract, value)
    return oid


def _lock(vm, contract, buyer, offer_id):
    _register(vm, contract, buyer)
    vm.sender = buyer
    vm.value = 0
    return int(contract.lock_order(offer_id))


def _trade(vm, contract, buyer, offer_id, url=PROOF_URL):
    tid = _lock(vm, contract, buyer, offer_id)
    vm.sender = buyer
    vm.value = 0
    contract.set_proof_url(tid, url)
    return tid


def _mock_vision(vm, llm_response):
    vm.mock_web(
        "proof.example",
        {
            "method": "GET",
            "response": {
                "status": 200,
                "headers": {},
                "body": b"\x89PNG\r\n\x1a\n" + b"A" * 128,
            },
        },
    )
    vm.mock_llm("arbiter", llm_response)


def _get_trade(contract, trade_id):
    return json.loads(contract.get_trade(trade_id))


def test_create_offer_rejects_zero_value(vm, contract, seller):
    vm.sender = seller
    vm.value = 0
    with vm.expect_revert("send some GEN value"):
        contract.create_offer("GEN", "IDR", "150000", "150000", "DANA")


def test_create_offer_rejects_unsupported_token_and_fiat(vm, contract, seller):
    vm.sender = seller
    vm.value = CRYPTO
    with vm.expect_revert("unsupported token"):
        contract.create_offer("USDT", "IDR", "150000", "150000", "DANA")
    with vm.expect_revert("unsupported fiat"):
        contract.create_offer("GEN", "EUR", "150000", "150000", "DANA")


def test_create_offer_sets_24h_expiry(vm, contract, seller):
    oid = _offer_id(vm, contract, seller)
    offer = json.loads(contract.get_offer(oid))
    assert int(offer["expires_at"]) - int(offer["created_at"]) == 24 * 3600


def test_lock_rejects_seller_buying_own_offer(vm, contract, seller):
    oid = _offer_id(vm, contract, seller)
    vm.sender = seller
    vm.value = 0
    with vm.expect_revert("seller cannot buy own offer"):
        contract.lock_order(oid)


def test_lock_rejects_expired_offer(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    _register(vm, contract, buyer)
    vm.warp("2027-01-02T02:00:00")
    vm.sender = buyer
    vm.value = 0
    with vm.expect_revert("offer has expired"):
        contract.lock_order(oid)


def test_proof_upload_is_buyer_only(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    tid = _lock(vm, contract, buyer, oid)
    vm.sender = seller
    vm.value = 0
    with vm.expect_revert("only buyer can upload proof"):
        contract.set_proof_url(tid, PROOF_URL)


def test_release_settles_exact_locked_amount(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    offer = json.loads(contract.get_offer(oid))
    tid = _trade(vm, contract, buyer, oid)
    vm.sender = seller
    vm.value = 0
    contract.release_crypto(tid)
    trade = _get_trade(contract, tid)
    assert trade["status"] == "released"
    # Displayed terms equal settlement terms: same amounts move.
    assert trade["crypto_amount"] == offer["crypto_amount"]
    assert trade["fiat_amount"] == offer["fiat_amount"]
    assert trade["rate"] == offer["rate"]


def test_release_cannot_run_twice(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    tid = _trade(vm, contract, buyer, oid)
    vm.sender = seller
    vm.value = 0
    contract.release_crypto(tid)
    with vm.expect_revert("not locked"):
        contract.release_crypto(tid)


def test_force_release_is_owner_only_and_single_use(vm, contract, seller, buyer, owner):
    oid = _offer_id(vm, contract, seller)
    tid = _trade(vm, contract, buyer, oid)
    vm.sender = seller
    vm.value = 0
    with vm.expect_revert("only owner"):
        contract.force_release(tid)
    vm.sender = owner
    contract.force_release(tid)
    assert _get_trade(contract, tid)["status"] == "released"
    with vm.expect_revert("not locked"):
        contract.force_release(tid)


def test_cancel_marks_cancelled(vm, contract, seller):
    oid = _offer_id(vm, contract, seller)
    vm.sender = seller
    vm.value = 0
    contract.cancel_offer(oid)
    assert json.loads(contract.get_offer(oid))["status"] == "cancelled"


def test_arbitrate_approve_releases(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    _mock_vision(vm, APPROVE_JSON)
    tid = _lock(vm, contract, buyer, oid)
    vm.sender = buyer
    vm.value = 0
    contract.set_proof_url(tid, PROOF_URL)
    vm.sender = seller
    vm.value = 0
    contract.arbitrate_ai(tid, "dana sudah masuk sesuai")
    assert _get_trade(contract, tid)["status"] == "released"


def test_arbitrate_reject_refunds(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    _mock_vision(vm, REJECT_JSON)
    tid = _lock(vm, contract, buyer, oid)
    vm.sender = buyer
    vm.value = 0
    contract.set_proof_url(tid, PROOF_URL)
    vm.sender = seller
    vm.value = 0
    contract.arbitrate_ai(tid, "dana sudah masuk sesuai")
    assert _get_trade(contract, tid)["status"] == "refunded"


def test_arbitrate_validator_compares_approved_field(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    _mock_vision(vm, APPROVE_JSON)
    tid = _lock(vm, contract, buyer, oid)
    vm.sender = buyer
    vm.value = 0
    contract.set_proof_url(tid, PROOF_URL)
    vm.sender = seller
    vm.value = 0
    contract.arbitrate_ai(tid, "dana sudah masuk sesuai")
    # Validator agrees when the payout-deciding field matches.
    assert vm.run_validator() is True
    # Validator disagrees when the payout-deciding field is tampered with.
    assert vm.run_validator(leader_result={"approved": False, "reason": "ok"}) is False


def test_arbitrate_rejects_bad_note(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    tid = _lock(vm, contract, buyer, oid)
    vm.sender = buyer
    vm.value = 0
    contract.set_proof_url(tid, PROOF_URL)
    vm.sender = seller
    vm.value = 0
    with vm.expect_revert("note 1-500 chars"):
        contract.arbitrate_ai(tid, "")
    with vm.expect_revert("note 1-500 chars"):
        contract.arbitrate_ai(tid, "x" * 501)


def test_register_marks_address(vm, contract, seller):
    assert contract.is_registered(str(seller)) is False
    _register(vm, contract, seller)
    assert contract.is_registered(str(seller)) is True


def test_unregistered_seller_cannot_offer(vm, contract, seller):
    vm.sender = seller
    vm.value = CRYPTO
    with vm.expect_revert("seller not registered"):
        contract.create_offer("GEN", "IDR", "150000", "150000", "DANA")


def test_unregistered_buyer_cannot_lock(vm, contract, seller, buyer):
    oid = _offer_id(vm, contract, seller)
    vm.sender = buyer
    vm.value = 0
    with vm.expect_revert("buyer not registered"):
        contract.lock_order(oid)
