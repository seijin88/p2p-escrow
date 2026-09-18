# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import typing


def _require(cond: bool, msg: str) -> None:
    """Clean rollback with a user-facing message (see p2p_escrow._require)."""
    if not cond:
        raise gl.vm.UserError(msg)


class UserProfile(gl.Contract):
    """
    On-chain bank account registry for P2P traders.
    Only the contract owner may register or update entries — an attacker
    cannot overwrite another trader's bank details by calling register()
    as themselves.  Traders read back their own entry via get_profile().
    """

    bank_name      : TreeMap[str, str]
    account_number : TreeMap[str, str]
    account_name   : TreeMap[str, str]
    owner          : Address

    def __init__(self) -> None:
        self.owner = gl.message.sender_address

    def _addr_key(self, addr: str) -> str:
        """Canonical storage key for an address (lowercase 0x-hex).

        `str(Address)` renders EIP-55 mixed case, while callers (and the
        escrow's own `_addr_key`) use lowercase hex — both must land on the
        same TreeMap key or lookups silently miss.
        """
        return str(addr).lower()

    @gl.public.write
    def register(
        self,
        bank_name      : str,
        account_number : str,
        account_name   : str,
    ) -> None:
        _require(gl.message.sender_address == self.owner,
                 "Only owner may register traders")
        addr = self._addr_key(gl.message.sender_address)
        self.bank_name[addr]      = bank_name
        self.account_number[addr] = account_number
        self.account_name[addr]   = account_name

    @gl.public.view
    def get_profile(self, addr: str) -> typing.Any:
        """Owner-readable: look up any trader's profile by address."""
        _require(gl.message.sender_address == self.owner, "Only owner")
        try:
            return {
                "address"        : addr,
                "bank_name"      : self.bank_name[addr],
                "account_number": self.account_number[addr],
                "account_name"  : self.account_name[addr],
            }
        except Exception:
            return None

    @gl.public.view
    def is_registered(self, addr: str) -> bool:
        try:
            self.bank_name[addr]
            return True
        except Exception:
            return False
