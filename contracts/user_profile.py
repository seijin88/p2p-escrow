# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import typing


class UserProfile(gl.Contract):
    """
    On-chain bank account registry for P2P traders.

    Every address must register their bank details before they can
    participate as a seller (post_offer) or buyer (lock_order) in
    P2PEscrow. The profile is stored permanently and can be updated
    by the owner at any time.

    AI arbitration uses seller's account_name from this registry to
    verify payment proof — the buyer cannot fabricate the recipient name.
    """

    # profiles: address (str) → JSON-encoded profile
    profiles: TreeMap[str, str]

    def __init__(self) -> None:
        pass

    # ── Write ──────────────────────────────────────────────────────────────

    @gl.public.write
    def register(
        self,
        bank_name      : str,
        account_number : str,
        account_name   : str,
    ) -> None:
        """Register or update bank account details for the calling address."""
        assert len(bank_name) >= 2,      "Bank name too short"
        assert len(account_number) >= 5, "Account number too short"
        assert len(account_name) >= 3,   "Account name too short"

        addr = str(gl.message.sender_address)
        self.profiles[addr] = _encode({
            "address"        : addr,
            "bank_name"      : bank_name,
            "account_number" : account_number,
            "account_name"   : account_name,
        })

    # ── Read ───────────────────────────────────────────────────────────────

    @gl.public.view
    def get_profile(self, addr: str) -> typing.Any:
        """Returns profile dict or None if not registered."""
        try:
            return _decode(self.profiles[addr])
        except Exception:
            return None

    @gl.public.view
    def is_registered(self, addr: str) -> bool:
        """Returns True if the address has a registered profile."""
        try:
            self.profiles[addr]
            return True
        except Exception:
            return False

    @gl.public.view
    def get_my_profile(self) -> typing.Any:
        """Returns the caller's own profile or None."""
        return self.get_profile(str(gl.message.sender_address))


# ── Helpers ────────────────────────────────────────────────────────────────

import json

def _encode(data: dict) -> str:
    return json.dumps(data)

def _decode(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    return json.loads(raw)
