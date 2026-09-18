"""Tests for UserProfile — owner-only administration (reviewer point 1).

The escrow never calls this contract on the trading path, but the reviewer
asked for its administration to be restricted: only the deployer (owner) may
register or update entries, so a bystander cannot write bank data into the
registry; and get_profile is owner-readable only, so bank details are not
world-readable plaintext.

Address note: the gltest fixtures hand out raw bytes and `str(bytes)` is a
repr, not an address — normalise to 0x-hex via conftest helpers (same
derivation as the fixtures).
"""
import os

from conftest import address_hex

CONTRACT_PATH = os.path.join("contracts", "user_profile.py")


def _deploy(direct_deploy):
    return direct_deploy(CONTRACT_PATH)


def test_register_rejects_non_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A non-deployer cannot register — only the owner administers the registry."""
    direct_vm.sender = direct_alice
    contract = _deploy(direct_deploy)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only owner may register traders"):
        contract.register("BCA", "1234567890", "Bob Trader")


def test_register_owner_succeeds_and_is_readable(
    direct_vm, direct_deploy, direct_alice
):
    """The deployer registers an entry and reads it back."""
    direct_vm.sender = direct_alice
    contract = _deploy(direct_deploy)

    contract.register("BCA", "1234567890", "Alice Seller")
    p = contract.get_profile(address_hex("alice"))
    assert p is not None
    assert p["bank_name"] == "BCA"
    assert p["account_number"] == "1234567890"
    assert p["account_name"] == "Alice Seller"


def test_get_profile_requires_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Bank details are plaintext — only the owner may read them back."""
    direct_vm.sender = direct_alice
    contract = _deploy(direct_deploy)
    contract.register("BCA", "1234567890", "Alice Seller")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only owner"):
        contract.get_profile(address_hex("alice"))


def test_is_registered_is_world_readable(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Existence of a registration is public; the details are not."""
    direct_vm.sender = direct_alice
    contract = _deploy(direct_deploy)
    contract.register("BCA", "1234567890", "Alice Seller")

    direct_vm.sender = direct_bob
    assert contract.is_registered(address_hex("alice")) is True
    assert contract.is_registered(address_hex("bob")) is False
