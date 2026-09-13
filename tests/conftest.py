"""
pytest configuration for P2PEscrow tests.
Uses genlayer-test direct mode — no Docker or network required.

This file carries three pieces of test infrastructure:

1. A Windows-only workaround for genlayer-test 0.29.2.
2. A UserProfile double — direct mode cannot make cross-contract calls, so the
   real second deployment would answer None for every profile lookup.
3. A native-transfer ledger, so settlement (who got paid, how much) is
   asserted by the tests instead of assumed.
"""

import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

# ── Windows-only workaround for genlayer-test 0.29.2 ──────────────────────────
# gltest.direct.loader._inject_message_to_fd0() writes the message context to a
# temp file, dup2()s it onto fd 0, then os.unlink()s it. That works on POSIX
# (unlinking an open file is legal) but fails on Windows with
# `PermissionError: [WinError 32] The process cannot access the file because it
# is being used by another process`, which makes every direct-mode test error
# out before the contract is even imported.
#
# We make os.unlink tolerant of that specific error for the duration of the
# call. The leaked temp file is a few hundred bytes in %TEMP% and is cleaned up
# by the OS; nothing else in the test run depends on it. CI (Linux) is
# unaffected — this block only runs on win32.
if sys.platform == "win32":
    from gltest.direct import loader as _gltest_loader

    _original_inject = _gltest_loader._inject_message_to_fd0

    def _inject_message_to_fd0_win_safe(vm):
        real_unlink = os.unlink

        def _tolerant_unlink(path, *args, **kwargs):
            try:
                real_unlink(path, *args, **kwargs)
            except PermissionError:
                pass

        os.unlink = _tolerant_unlink
        try:
            return _original_inject(vm)
        finally:
            os.unlink = real_unlink

    _gltest_loader._inject_message_to_fd0 = _inject_message_to_fd0_win_safe


# ── Test doubles ──────────────────────────────────────────────────────────────

import hashlib  # noqa: E402

from gltest.direct.loader import deploy_contract  # noqa: E402

#: Address the escrow is pointed at in tests. Any 20-byte address works: the
#: double below answers for it instead of a real deployed contract.
PROFILE_ADDRESS = "0x" + "ab" * 20

_ESCROW_BASENAME = "p2p_escrow.py"

#: Traders registered in the profile double unless a test says otherwise.
DEFAULT_TRADERS = ("alice", "bob", "charlie", "default_sender")


def address_hex(seed: str) -> str:
    """Canonical `0x`-hex address for `seed`.

    Same derivation the gltest fixtures use (`sha256(seed)[:20]`) but computed
    here rather than through `create_address`, which returns raw bytes before a
    contract has been loaded and put the SDK on sys.path.
    """
    return "0x" + hashlib.sha256(seed.encode()).digest()[:20].hex()


class ProfileDouble:
    """In-process stand-in for the UserProfile contract.

    gltest's direct mode has no cross-contract support: `gl_call` returns
    nothing unless a hook is installed, so a second real deployment answers
    `None` for every view and the escrow could never tell "unregistered" from
    "profile contract unreachable". This double implements exactly the two view
    methods the escrow calls, behind the same
    `gl.get_contract_at(addr).view().<method>(...)` call path.
    """

    def __init__(self, registered=DEFAULT_TRADERS):
        self.accounts = {}
        for seed in registered:
            self.register(address_hex(seed))

    # -- double-side API (what the tests use) ---------------------------------

    def register(self, addr_hex, bank="BCA", number="1234567890", name="Test Trader"):
        self.accounts[addr_hex.lower()] = {
            "address"        : addr_hex,
            "bank_name"      : bank,
            "account_number" : number,
            "account_name"   : name,
        }

    def unregister(self, addr_hex):
        self.accounts.pop(addr_hex.lower(), None)

    # -- contract-side API (what the escrow calls) ----------------------------

    def view(self):
        """Mirror of the SDK proxy: `proxy.view().is_registered(...)`."""
        return self

    def is_registered(self, addr_hex) -> bool:
        return str(addr_hex).lower() in self.accounts

    def get_profile(self, addr_hex):
        return self.accounts.get(str(addr_hex).lower())

    def emit_transfer(self, *, value, on="finalized"):  # pragma: no cover
        raise AssertionError("the profile contract must never receive a payout")


class _PayoutTarget:
    """Proxy for a payout recipient: records the transfer instead of sending."""

    def __init__(self, addr_hex, ledger):
        self._addr_hex = addr_hex
        self._ledger = ledger

    @property
    def address(self):
        return self._addr_hex

    def emit_transfer(self, *, value, on="finalized"):
        self._ledger.entries.append((self._addr_hex.lower(), int(value)))

    def view(self):
        raise AssertionError(f"unexpected view call on {self._addr_hex}")


class TransferLedger:
    """Native GEN payouts attempted by the contract, as (recipient, amount).

    The contract pays with `gl.get_contract_at(to).emit_transfer(value=...)`.
    Direct mode has no WASI host to execute that, so without a ledger the suite
    could not distinguish a real payout from a silent no-op.
    """

    def __init__(self):
        self.entries = []

    def total(self, addr) -> int:
        key = normalize_address(addr)
        return sum(amount for to, amount in self.entries if to == key)

    def recipients(self) -> list:
        return [to for to, _ in self.entries]

    def clear(self):
        self.entries.clear()


def normalize_address(addr) -> str:
    """Canonical lowercase `0x`-hex for an Address, hex string or raw bytes.

    The gltest fixtures hand out raw bytes for `direct_alice`/`direct_bob`, and
    `str(bytes)` is a repr (`b'...'`) rather than an address, so bytes must be
    hex-encoded before it can be compared with what the contract stores.
    """
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    return str(addr).lower()


@pytest.fixture(autouse=True)
def vm_instrumentation(monkeypatch):
    """Profile double + payout ledger, installed on the SDK once it is importable.

    `genlayer` only lands on sys.path when a contract is first loaded, so the
    patch cannot be installed at fixture time — `direct_deploy` calls
    `install()` right after deploying, i.e. before the test body touches the
    contract.
    """
    double = ProfileDouble()
    ledger = TransferLedger()

    def install():
        import genlayer.gl as gl

        _patch_warp_to_move_message_time()
        if getattr(gl.get_contract_at, "_hermes_instrumented", False):
            return

        def fake_get_contract_at(addr):
            if str(addr).lower() == PROFILE_ADDRESS.lower():
                return double
            return _PayoutTarget(str(addr), ledger)

        fake_get_contract_at._hermes_instrumented = True
        monkeypatch.setattr(gl, "get_contract_at", fake_get_contract_at)

    return SimpleNamespace(profile=double, transfers=ledger, install=install)


def _patch_warp_to_move_message_time():
    """Make `direct_vm.warp()` move the message datetime too.

    Production delivers the transaction datetime inside the message, and the
    contract reads it from `gl.message_raw['datetime']`. gltest's `warp()` only
    fakes `datetime.datetime.now()`: it leaves `message_raw['datetime']` at the
    value injected when the contract was loaded, so window tests would silently
    test nothing unless warp updates both.
    """
    from gltest.direct.vm import VMContext

    if getattr(VMContext.warp, "_hermes_patched", False):
        return

    original_warp = VMContext.warp

    def warp(self, timestamp):
        original_warp(self, timestamp)
        gl = sys.modules.get("genlayer.gl")
        raw = getattr(gl, "message_raw", None) if gl is not None else None
        if raw is not None:
            raw["datetime"] = self._datetime

    warp._hermes_patched = True
    VMContext.warp = warp


@pytest.fixture
def profile(vm_instrumentation):
    """The UserProfile double: register/unregister traders per test."""
    return vm_instrumentation.profile


@pytest.fixture
def transfers(vm_instrumentation):
    """Native-transfer ledger: assert who was paid what on settlement."""
    return vm_instrumentation.transfers


@pytest.fixture
def direct_deploy(direct_vm, vm_instrumentation, request):
    """direct_deploy + profile wiring.

    Same deploy semantics as gltest's fixture (relative contract paths resolve
    against cwd, cwd/contracts and cwd/intelligent-contracts), plus: every
    escrow is pointed at PROFILE_ADDRESS the way an owner would in production
    (`set_user_profile_contract`), because the escrow refuses to trade until
    that gate is configured. Mark a test with `@pytest.mark.unwired_profile`
    to get the escrow exactly as deployed, gate still open.
    """
    unwired = request.node.get_closest_marker("unwired_profile") is not None

    def _deploy(contract_path, *args, **kwargs):
        contract = deploy_contract(_resolve(contract_path), direct_vm, *args, **kwargs)
        vm_instrumentation.install()
        if not unwired and os.path.basename(str(contract_path)) == _ESCROW_BASENAME:
            contract.set_user_profile_contract(PROFILE_ADDRESS)
        return contract

    return _deploy


def _resolve(contract_path):
    """Resolve a contract path the way gltest's direct_deploy fixture does."""
    path = Path(contract_path)
    if path.is_absolute():
        return path
    if path.exists():
        return path.resolve()
    for base in (Path.cwd(), Path.cwd() / "contracts", Path.cwd() / "intelligent-contracts"):
        candidate = base / contract_path
        if candidate.exists():
            return candidate.resolve()
    return path


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "unwired_profile: deploy the escrow without a configured profile contract",
    )
