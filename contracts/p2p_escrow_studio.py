# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from datetime import datetime, timezone
import json
import typing

SUPPORTED_TOKENS = ["GEN"]
SUPPORTED_FIAT = ["IDR", "USD"]
OFFER_EXPIRY = 24 * 3600  # 24 h — offer auto-expires if no buyer locks


@gl.evm.contract_interface
class _Recipient:
    class Write:
        pass

    class View:
        pass


class P2PEscrow(gl.Contract):
    owner: Address
    offer_counter: u256
    trade_counter: u256
    offers: TreeMap[u256, str]
    trades: TreeMap[u256, str]
    registered: TreeMap[u256, u256]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.offer_counter = u256(0)
        self.trade_counter = u256(0)

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _addr_key(self, addr: str) -> u256:
        try:
            return u256(int(str(addr), 16))
        except Exception:
            raise gl.vm.UserError("invalid address")

    def _is_registered(self, addr: str) -> bool:
        try:
            return self.registered[self._addr_key(addr)] == u256(1)
        except Exception:
            return False

    def _load_offer(self, offer_id: u256) -> dict:
        try:
            return json.loads(self.offers[offer_id])
        except Exception:
            raise gl.vm.UserError("offer not found")

    def _save_offer(self, offer_id: u256, offer: dict) -> None:
        self.offers[offer_id] = json.dumps(offer)

    def _load_trade(self, trade_id: u256) -> dict:
        try:
            return json.loads(self.trades[trade_id])
        except Exception:
            raise gl.vm.UserError("trade not found")

    def _save_trade(self, trade_id: u256, trade: dict) -> None:
        self.trades[trade_id] = json.dumps(trade)

    def _check_funds(self, crypto_amount: u256) -> None:
        if self.balance < crypto_amount:
            raise gl.vm.UserError("insufficient contract balance")

    def _payout(self, to: str, crypto_amount: u256) -> None:
        self._check_funds(crypto_amount)
        _Recipient(Address(to)).emit_transfer(value=crypto_amount)

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_balance(self) -> u256:
        return self.balance

    @gl.public.view
    def get_offer_count(self) -> u256:
        return self.offer_counter

    @gl.public.view
    def get_trade_count(self) -> u256:
        return self.trade_counter

    @gl.public.write
    def register(self) -> None:
        # Self-registration only: no admin keys, no PII on-chain.
        self.registered[self._addr_key(str(gl.message.sender_address))] = u256(1)

    @gl.public.view
    def is_registered(self, addr: str) -> bool:
        return self._is_registered(addr)

    @gl.public.view
    def get_offer(self, offer_id: u256) -> str:
        return json.dumps(self._load_offer(offer_id))

    @gl.public.view
    def get_trade(self, trade_id: u256) -> str:
        return json.dumps(self._load_trade(trade_id))

    @gl.public.write.payable
    def create_offer(
        self,
        token: str,
        fiat_currency: str,
        fiat_amount: str,
        rate: str,
        payment_methods: str,
    ) -> u256:
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("send some GEN value")
        if token not in SUPPORTED_TOKENS:
            raise gl.vm.UserError("unsupported token")
        if fiat_currency not in SUPPORTED_FIAT:
            raise gl.vm.UserError("unsupported fiat")
        if not self._is_registered(str(gl.message.sender_address)):
            raise gl.vm.UserError("seller not registered")
        offer_id = self.offer_counter
        self.offer_counter += u256(1)
        now = self._now()
        offer = json.dumps(
            {
                "offer_id": int(offer_id),
                "seller": str(gl.message.sender_address),
                "token": token,
                "crypto_amount": str(value),
                "fiat_currency": fiat_currency,
                "fiat_amount": fiat_amount,
                "rate": rate,
                "payment_methods": payment_methods,
                "status": "open",
                "created_at": now,
                "expires_at": now + OFFER_EXPIRY,
            }
        )
        self.offers[offer_id] = offer
        return u256(offer_id)

    @gl.public.write
    def cancel_offer(self, offer_id: u256) -> None:
        offer = self._load_offer(offer_id)
        seller = str(gl.message.sender_address)
        if str(offer["seller"]).lower() != seller.lower():
            raise gl.vm.UserError("only seller")
        if offer["status"] != "open":
            raise gl.vm.UserError("not open")
        crypto_amount = u256(int(offer["crypto_amount"]))
        offer["status"] = "cancelled"
        self._save_offer(offer_id, offer)
        self._payout(str(offer["seller"]), crypto_amount)

    @gl.public.write
    def lock_order(self, offer_id: u256) -> u256:
        offer = self._load_offer(offer_id)
        buyer = str(gl.message.sender_address)
        if offer["status"] != "open":
            raise gl.vm.UserError("not open")
        if buyer.lower() == str(offer["seller"]).lower():
            raise gl.vm.UserError("seller cannot buy own offer")
        if not self._is_registered(buyer):
            raise gl.vm.UserError("buyer not registered")
        if self._now() > int(offer["expires_at"]):
            raise gl.vm.UserError("offer has expired")
        trade_id = self.trade_counter
        self.trade_counter += u256(1)
        offer["status"] = "locked"
        self._save_offer(offer_id, offer)
        trade = json.dumps(
            {
                "trade_id": int(trade_id),
                "offer_id": int(offer_id),
                "seller": offer["seller"],
                "buyer": buyer,
                "token": offer["token"],
                "crypto_amount": offer["crypto_amount"],
                "fiat_currency": offer["fiat_currency"],
                "fiat_amount": offer["fiat_amount"],
                "rate": offer["rate"],
                "payment_methods": offer["payment_methods"],
                "proof_url": "",
                "status": "locked",
            }
        )
        self.trades[trade_id] = trade
        return u256(trade_id)

    @gl.public.write
    def set_proof_url(self, trade_id: u256, url: str) -> None:
        trade = self._load_trade(trade_id)
        buyer = str(gl.message.sender_address)
        if trade["status"] != "locked":
            raise gl.vm.UserError("not locked")
        if buyer.lower() != str(trade["buyer"]).lower():
            raise gl.vm.UserError("only buyer can upload proof")
        if not url.startswith("http"):
            raise gl.vm.UserError("invalid proof url")
        trade["proof_url"] = url
        self._save_trade(trade_id, trade)

    @gl.public.write
    def release_crypto(self, trade_id: u256) -> None:
        trade = self._load_trade(trade_id)
        sender = str(gl.message.sender_address)
        if trade["status"] != "locked":
            raise gl.vm.UserError("not locked")
        if sender.lower() != str(trade["seller"]).lower() and sender.lower() != str(self.owner).lower():
            raise gl.vm.UserError("not authorized")
        crypto_amount = u256(int(trade["crypto_amount"]))
        trade["status"] = "released"
        self._save_trade(trade_id, trade)
        self._payout(str(trade["buyer"]), crypto_amount)

    @gl.public.write
    def force_release(self, trade_id: u256) -> None:
        trade = self._load_trade(trade_id)
        sender = str(gl.message.sender_address)
        if sender.lower() != str(self.owner).lower():
            raise gl.vm.UserError("only owner")
        if trade["status"] != "locked":
            raise gl.vm.UserError("not locked")
        crypto_amount = u256(int(trade["crypto_amount"]))
        trade["status"] = "released"
        self._save_trade(trade_id, trade)
        self._payout(str(trade["buyer"]), crypto_amount)

    @gl.public.write
    def arbitrate_ai(self, trade_id: u256, seller_note: str) -> None:
        try:
            trade = self._load_trade(trade_id)
            sender = str(gl.message.sender_address).lower()
            if trade["status"] != "locked":
                raise gl.vm.UserError("not locked")
            if sender != str(trade["seller"]).lower() and sender != str(self.owner).lower():
                raise gl.vm.UserError("Only seller or owner can trigger AI")
            proof_url = trade.get("proof_url", "")
            if not proof_url.startswith("http"):
                raise gl.vm.UserError("Proof URL missing")
            if not 1 <= len(seller_note) <= 500:
                raise gl.vm.UserError("note 1-500 chars")
            trade["seller_note"] = seller_note
            self._save_trade(trade_id, trade)

            prompt = (
                "Escrow arbiter: buyer pays fiat OFF-CHAIN, screenshot is proof. "
                "Approve ONLY if image shows real receipt of "
                f"{trade['fiat_amount']} {trade['fiat_currency']} "
                f"via {trade['payment_methods']}. "
                f"Seller statement: {seller_note}. "
                'ONLY JSON: {"approved": true/false, "reason": ""}.'
            )

            def _parse_arbiter_json(response: typing.Any) -> dict:
                data = response
                if isinstance(data, str):
                    text = data.strip()
                    if text.startswith("```"):
                        text = text[text.find("{"):text.rfind("}") + 1]
                    try:
                        data = json.loads(text)
                    except Exception:
                        raise gl.vm.UserError("LLM bad JSON")
                if not isinstance(data, dict):
                    raise gl.vm.UserError("LLM bad JSON")
                approved = data.get("approved", data.get("approve"))
                if isinstance(approved, str):
                    approved = approved.strip().lower() in ("true", "yes", "1", "approved")
                if not isinstance(approved, bool):
                    raise gl.vm.UserError("LLM bad approved")
                return {"approved": approved, "reason": str(data.get("reason", ""))}

            def _is_image(body: bytes) -> bool:
                if not isinstance(body, bytes) or len(body) < 4:
                    return False
                head = body[:12]
                return head[:4] == b"\x89PNG" or head[:3] in (b"\xff\xd8\xff", b"GIF") or head[:4] == b"RIFF" and body[8:12] == b"WEBP"

            def leader_fn() -> typing.Any:
                try:
                    resp = gl.nondet.web.get(proof_url)
                    body = resp.body
                    if isinstance(body, str):
                        body = body.encode("utf-8")
                except Exception:
                    raise gl.vm.UserError("proof content not accessible")
                if not body:
                    raise gl.vm.UserError("proof content empty")
                if not _is_image(body):
                    raise gl.vm.UserError("proof is not a direct image, use image file link")
                response = gl.nondet.exec_prompt(
                    prompt, images=[body], response_format="json"
                )
                return _parse_arbiter_json(response)

            def validator_fn(leader_result) -> bool:
                if not isinstance(leader_result, gl.vm.Return):
                    return False
                try:
                    leader_data = leader_result.calldata
                    if not isinstance(leader_data, dict):
                        return False
                    validator_data = leader_fn()
                    return bool(leader_data.get("approved")) == bool(validator_data.get("approved"))
                except Exception:
                    return False

            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            if not isinstance(result, dict):
                raise gl.vm.UserError("arbitrate_ai: invalid result")
            crypto_amount = u256(int(trade["crypto_amount"]))
            if bool(result.get("approved", False)):
                trade["status"] = "released"
                self._save_trade(trade_id, trade)
                self._payout(str(trade["buyer"]), crypto_amount)
            else:
                trade["status"] = "refunded"
                self._save_trade(trade_id, trade)
                self._payout(str(trade["seller"]), crypto_amount)
        except Exception as e:
            raise gl.vm.UserError(f"arbitrate_ai: {str(e)}")
