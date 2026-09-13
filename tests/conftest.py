"""
pytest configuration for P2PEscrow tests.
Uses genlayer-test direct mode — no Docker or network required.

Three pieces of test infrastructure live here:

1. A Windows-only workaround for genlayer-test 0.29.2.
2. A native-transfer ledger, so settlement (who got paid, how much) is
   asserted by the tests instead of assumed.
3. Profile reporting at deploy time, so tests express who is allowed to trade.
"""

import hashlib
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

from gltest.direct.loader import deploy_contract  # noqa: E402

_ESCROW_BASENAME = "p2p_escrow.py"

#: Traders that have reported a bank profile by the time a test body runs.
#: Override the `reported_traders` fixture in a test to control who may trade.
DEFAULT_TRADERS = ("alice", "bob", "charlie", "default_sender")


def address_bytes(seed: str) -> bytes:
    """Raw 20-byte address for `seed` (same derivation as the gltest fixtures)."""
    return hashlib.sha256(seed.encode()).digest()[:20]


def address_hex(seed: str) -> str:
    """`0x`-hex address for `seed` — the form the contract stores and returns."""
    return "0x" + address_bytes(seed).hex()


def normalize_address(addr) -> str:
    """Canonical lowercase `0x`-hex for an Address, hex string or raw bytes.

    The gltest fixtures hand out raw bytes for `direct_alice`/`direct_bob`, and
    `str(bytes)` is a repr (`b'...'`) rather than an address, so bytes must be
    hex-encoded before it can be compared with what the contract stores.
    """
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    return str(addr).lower()


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
        raise AssertionError(
            f"the escrow must not read another contract ({self._addr_hex}): "
            "trading is gated by locally reported profiles"
        )


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


@pytest.fixture(autouse=True)
def vm_instrumentation(monkeypatch):
    """Payout ledger + warp/time patch, installed once the SDK is importable.

    `genlayer` only lands on sys.path when a contract is first loaded, so the
    patch cannot be installed at fixture time — `direct_deploy` calls
    `install()` right after deploying, i.e. before the test body touches the
    contract.
    """
    ledger = TransferLedger()

    def install():
        import genlayer.gl as gl

        if getattr(gl.get_contract_at, "_hermes_instrumented", False):
            return

        def fake_get_contract_at(addr):
            return _PayoutTarget(normalize_address(addr), ledger)

        fake_get_contract_at._hermes_instrumented = True
        monkeypatch.setattr(gl, "get_contract_at", fake_get_contract_at)

    return SimpleNamespace(transfers=ledger, install=install)


@pytest.fixture
def transfers(vm_instrumentation):
    """Native-transfer ledger: assert who was paid what on settlement."""
    return vm_instrumentation.transfers


@pytest.fixture
def reported_traders():
    """Seeds that have reported a bank profile on the escrow, by default all of them.

    Override in a test to control who is allowed to trade — an empty tuple
    leaves nobody reported, which is what the enforcement tests need.
    """
    return DEFAULT_TRADERS


@pytest.fixture
def direct_deploy(direct_vm, vm_instrumentation, request):
    """direct_deploy + profile reports.

    Same deploy semantics as gltest's fixture (relative contract paths resolve
    against cwd, cwd/contracts and cwd/intelligent-contracts), plus: after an
    escrow is deployed, each seed in `reported_traders` calls `report_profile`
    as itself — which is also the only way a trader can report, so this mirrors
    production exactly.
    """
    def _deploy(contract_path, *args, **kwargs):
        contract = deploy_contract(_resolve(contract_path), direct_vm, *args, **kwargs)
        vm_instrumentation.install()

        if os.path.basename(str(contract_path)) == _ESCROW_BASENAME:
            traders = request.getfixturevalue("reported_traders")
            if traders:
                sender_before = direct_vm.sender
                try:
                    for seed in traders:
                        direct_vm.sender = address_bytes(seed)
                        contract.report_profile("BCA", "1234567890", f"{seed} trader")
                finally:
                    direct_vm.sender = sender_before

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
