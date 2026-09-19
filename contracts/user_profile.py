# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import typing


class UserProfile(gl.Contract):
    """
    On-chain bank account registry for P2P traders.
    Each address stores: bank_name|account_number|account_name
    """

    bank_name      : TreeMap[str, str]
    account_number : TreeMap[str, str]
    account_name   : TreeMap[str, str]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def register(
        self,
        bank_name      : str,
        account_number : str,
        account_name   : str,
    ) -> None:
        addr = str(gl.message.sender_address)
        self.bank_name[addr]      = bank_name
        self.account_number[addr] = account_number
        self.account_name[addr]   = account_name

    @gl.public.view
    def get_profile(self, addr: str) -> typing.Any:
        try:
            bn  = self.bank_name[addr]
            an  = self.account_number[addr]
            anm = self.account_name[addr]
            return {
                "address"        : addr,
                "bank_name"      : bn,
                "account_number" : an,
                "account_name"   : anm,
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
