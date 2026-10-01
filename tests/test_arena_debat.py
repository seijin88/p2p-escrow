"""Direct-mode tests for contracts/arena_debat.py."""

import json
from pathlib import Path

import pytest

from gltest.direct import deploy_contract

ARENA_PATH = Path(__file__).resolve().parent.parent / "contracts" / "arena_debat.py"

STAKE = 10**18
JUDGE_A = '{"score_a": 8, "score_b": 5, "reason": "A clearer"}'
JUDGE_DRAW = '{"score_a": 6, "score_b": 6, "reason": "even"}'


@pytest.fixture
def arena(vm, owner):
    vm.sender = owner
    vm.value = 0
    return deploy_contract(ARENA_PATH, vm)


def _fund(vm, arena, amount):
    arena_addr = vm._contract_address
    vm.deal(arena_addr, int(arena.get_balance()) + amount)


def _create(vm, arena, challenger, topic="Nasi goreng vs mie goreng", value=STAKE):
    vm.sender = challenger
    vm.value = value
    mid = int(arena.create_match(topic))
    if value:
        _fund(vm, arena, value)
    return mid


def _join(vm, arena, opponent, mid, value=STAKE):
    vm.sender = opponent
    vm.value = value
    arena.join_match(mid)
    if value:
        _fund(vm, arena, value)


def _submit(vm, arena, who, mid, text):
    vm.sender = who
    vm.value = 0
    return int(arena.submit_argument(mid, text))


def _mock_judge(vm, payload):
    vm.mock_llm("judge", payload)


def _match(arena, mid):
    return json.loads(arena.get_match(mid))


def test_create_and_join_flow(vm, arena, seller, buyer):
    mid = _create(vm, arena, seller)
    assert _match(arena, mid)["status"] == "open"
    _join(vm, arena, buyer, mid)
    m = _match(arena, mid)
    assert m["status"] == "ready"
    assert len(m["rounds"]) == 3


def test_join_rejects_wrong_stake(vm, arena, seller, buyer):
    mid = _create(vm, arena, seller)
    vm.sender = buyer
    vm.value = STAKE // 2
    with vm.expect_revert("stake mismatch"):
        arena.join_match(mid)


def test_submit_takes_turns(vm, arena, seller, buyer):
    mid = _create(vm, arena, seller)
    _join(vm, arena, buyer, mid)
    assert _submit(vm, arena, seller, mid, "argumen A ronde 1") == 0
    assert _submit(vm, arena, buyer, mid, "argumen B ronde 1") == 0
    assert _submit(vm, arena, seller, mid, "argumen A ronde 2") == 1


def test_bet_validation(vm, arena, seller, buyer, owner):
    mid = _create(vm, arena, seller)
    vm.sender = owner
    vm.value = 0
    with vm.expect_revert("stake some GEN"):
        arena.place_bet(mid, "a")
    vm.value = STAKE
    with vm.expect_revert("side a or b"):
        arena.place_bet(mid, "c")
    vm.sender = owner
    vm.value = STAKE
    arena.place_bet(mid, "a")
    _fund(vm, arena, STAKE)
    m = _match(arena, mid)
    assert len(m["bets"]) == 1 and m["bets"][0]["side"] == "a"


def test_full_match_pays_winner_and_bettors(vm, arena, seller, buyer, owner):
    mid = _create(vm, arena, seller)
    _join(vm, arena, buyer, mid)
    vm.sender = owner
    vm.value = STAKE
    arena.place_bet(mid, "a")
    _fund(vm, arena, STAKE)
    _mock_judge(vm, JUDGE_A)
    for r in range(3):
        _submit(vm, arena, seller, mid, f"A{r}")
        _submit(vm, arena, buyer, mid, f"B{r}")
        vm.sender = seller
        vm.value = 0
        arena.resolve_round(mid, r)
    vm.sender = seller
    vm.value = 0
    arena.resolve_final(mid)
    m = _match(arena, mid)
    assert m["status"] == "resolved"
    assert m["winner"].lower() == str(seller).lower()
    with vm.expect_revert("betting closed"):
        vm.sender = owner
        vm.value = STAKE
        arena.place_bet(mid, "a")


def test_draw_refunds(vm, arena, seller, buyer):
    mid = _create(vm, arena, seller)
    _join(vm, arena, buyer, mid)
    _mock_judge(vm, JUDGE_DRAW)
    for r in range(3):
        _submit(vm, arena, seller, mid, f"A{r}")
        _submit(vm, arena, buyer, mid, f"B{r}")
        vm.sender = seller
        vm.value = 0
        arena.resolve_round(mid, r)
    vm.sender = seller
    vm.value = 0
    arena.resolve_final(mid)
    assert _match(arena, mid)["status"] == "draw"


def test_validator_compares_round_winner(vm, arena, seller, buyer):
    mid = _create(vm, arena, seller)
    _join(vm, arena, buyer, mid)
    _mock_judge(vm, JUDGE_A)
    _submit(vm, arena, seller, mid, "A")
    _submit(vm, arena, buyer, mid, "B")
    vm.sender = seller
    vm.value = 0
    arena.resolve_round(mid, 0)
    assert vm.run_validator() is True
    assert vm.run_validator(
        leader_result={"score_a": 2, "score_b": 9, "reason": "x"}) is False


def test_claim_timeout_open(vm, arena, seller):
    mid = _create(vm, arena, seller)
    vm.warp("2030-01-02T00:00:00")
    vm.sender = seller
    vm.value = 0
    arena.claim_timeout(mid)
    assert _match(arena, mid)["status"] == "cancelled"


def test_cancel_match(vm, arena, seller):
    mid = _create(vm, arena, seller)
    vm.sender = seller
    vm.value = 0
    arena.cancel_match(mid)
    assert _match(arena, mid)["status"] == "cancelled"
