# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from datetime import datetime, timezone
import json
import typing

JOIN_WINDOW = 24 * 3600
MATCH_EXPIRY = 7 * 24 * 3600
ROUNDS_DEFAULT = 3
ARG_MAX = 1000


@gl.evm.contract_interface
class _Recipient:
    class Write:
        pass

    class View:
        pass


class ArenaDebat(gl.Contract):
    owner: Address
    match_counter: u256
    matches: TreeMap[u256, str]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.match_counter = u256(0)

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _load(self, mid: u256) -> dict:
        try:
            return json.loads(self.matches[mid])
        except Exception:
            raise gl.vm.UserError("match not found")

    def _save(self, mid: u256, m: dict) -> None:
        self.matches[mid] = json.dumps(m)

    def _payout(self, to: str, amount: u256) -> None:
        if self.balance < amount:
            raise gl.vm.UserError("insufficient contract balance")
        _Recipient(Address(to)).emit_transfer(value=amount)

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_balance(self) -> u256:
        return self.balance

    @gl.public.view
    def get_match_count(self) -> u256:
        return self.match_counter

    @gl.public.view
    def get_match(self, match_id: u256) -> str:
        return json.dumps(self._load(match_id))

    @gl.public.write.payable
    def create_match(self, topic: str) -> u256:
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("stake some GEN")
        if not 1 <= len(topic) <= 280:
            raise gl.vm.UserError("topic 1-280 chars")
        mid = self.match_counter
        self.match_counter += u256(1)
        now = self._now()
        self._save(mid, {
            "match_id": int(mid),
            "challenger": str(gl.message.sender_address),
            "opponent": "",
            "topic": topic,
            "stake": str(value),
            "rounds": [],
            "rounds_total": ROUNDS_DEFAULT,
            "status": "open",
            "winner": "",
            "bets": [],
            "created_at": now,
            "join_deadline": now + JOIN_WINDOW,
            "expires_at": now + MATCH_EXPIRY,
        })
        return u256(mid)

    @gl.public.write
    def cancel_match(self, match_id: u256) -> None:
        m = self._load(match_id)
        if str(m["challenger"]).lower() != str(gl.message.sender_address).lower():
            raise gl.vm.UserError("only challenger")
        if m["status"] != "open":
            raise gl.vm.UserError("not open")
        m["status"] = "cancelled"
        self._save(match_id, m)
        self._payout(str(m["challenger"]), u256(int(m["stake"])))

    @gl.public.write.payable
    def join_match(self, match_id: u256) -> None:
        m = self._load(match_id)
        if m["status"] != "open":
            raise gl.vm.UserError("not open")
        if self._now() > int(m["join_deadline"]):
            raise gl.vm.UserError("join window closed")
        if str(m["challenger"]).lower() == str(gl.message.sender_address).lower():
            raise gl.vm.UserError("challenger cannot join own match")
        if gl.message.value != u256(int(m["stake"])):
            raise gl.vm.UserError("stake mismatch")
        m["opponent"] = str(gl.message.sender_address)
        m["status"] = "ready"
        m["rounds"] = [{"a": "", "b": "", "score_a": 0, "score_b": 0,
                        "reason": "", "done": False}
                       for _ in range(int(m["rounds_total"]))]
        self._save(match_id, m)

    @gl.public.write.payable
    def place_bet(self, match_id: u256, side: str) -> None:
        m = self._load(match_id)
        if m["status"] not in ("open", "ready", "ongoing"):
            raise gl.vm.UserError("betting closed")
        if side not in ("a", "b"):
            raise gl.vm.UserError("side a or b")
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("stake some GEN")
        bets = m.get("bets", [])
        bets.append({"bettor": str(gl.message.sender_address),
                     "side": side, "amount": str(value)})
        m["bets"] = bets
        self._save(match_id, m)

    @gl.public.write
    def submit_argument(self, match_id: u256, text: str) -> u256:
        m = self._load(match_id)
        if m["status"] not in ("ready", "ongoing"):
            raise gl.vm.UserError("match not playable")
        if self._now() > int(m["expires_at"]):
            raise gl.vm.UserError("match expired")
        sender = str(gl.message.sender_address).lower()
        side = "a" if sender == str(m["challenger"]).lower() else (
            "b" if sender == str(m["opponent"]).lower() else "")
        if not side:
            raise gl.vm.UserError("not a debater")
        if not 1 <= len(text) <= ARG_MAX:
            raise gl.vm.UserError("argument 1-1000 chars")
        rid = -1
        for i, r in enumerate(m["rounds"]):
            if not r[side] and not r["done"]:
                rid = i
                break
        if rid < 0:
            raise gl.vm.UserError("no open round")
        m["rounds"][rid][side] = text
        m["status"] = "ongoing"
        self._save(match_id, m)
        return u256(rid)

    def _parse_scores(self, response: typing.Any) -> dict:
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

        def _score(v: typing.Any) -> int:
            try:
                s = int(round(float(str(v).strip())))
            except Exception:
                raise gl.vm.UserError("LLM bad score")
            return max(0, min(10, s))

        sa = _score(data.get("score_a", data.get("a")))
        sb = _score(data.get("score_b", data.get("b")))
        return {"score_a": sa, "score_b": sb,
                "reason": str(data.get("reason", ""))}

    @gl.public.write
    def resolve_round(self, match_id: u256, round_idx: u256) -> None:
        m = self._load(match_id)
        if m["status"] not in ("ready", "ongoing"):
            raise gl.vm.UserError("match not playable")
        ri = int(round_idx)
        if not 0 <= ri < len(m["rounds"]):
            raise gl.vm.UserError("bad round")
        r = m["rounds"][ri]
        if r["done"]:
            raise gl.vm.UserError("round done")
        arg_a, arg_b = r["a"], r["b"]
        if (not arg_a or not arg_b) and self._now() <= int(m["expires_at"]):
            raise gl.vm.UserError("waiting sides")

        prompt = (
            "Impartial debate judge. Topic: " + m["topic"] + ". "
            "Side A: " + (arg_a or "(absent)") + " Side B: " + (arg_b or "(absent)") + " "
            "Score each 0-10 on argument quality. "
            'ONLY JSON: {"score_a": N, "score_b": N, "reason": ""}.'
        )

        def leader_fn() -> typing.Any:
            response = gl.nondet.exec_prompt(prompt, response_format="json")
            return self._parse_scores(response)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                mine = leader_fn()
                lead = leader_result.calldata
                if not isinstance(lead, dict):
                    return False

                def _w(d) -> int:
                    return 1 if d["score_a"] > d["score_b"] else (
                        -1 if d["score_a"] < d["score_b"] else 0)

                return _w(mine) == _w(lead)
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        if not isinstance(result, dict):
            raise gl.vm.UserError("judge: invalid result")
        r["score_a"] = int(result["score_a"])
        r["score_b"] = int(result["score_b"])
        r["reason"] = str(result.get("reason", ""))
        r["done"] = True
        self._save(match_id, m)

    @gl.public.write
    def resolve_final(self, match_id: u256) -> None:
        m = self._load(match_id)
        if m["status"] not in ("ready", "ongoing"):
            raise gl.vm.UserError("match not playable")
        if any(not r["done"] for r in m["rounds"]):
            raise gl.vm.UserError("rounds pending")
        pa = sum(int(r["score_a"]) for r in m["rounds"])
        pb = sum(int(r["score_b"]) for r in m["rounds"])
        stake = u256(int(m["stake"]))
        bets = m.get("bets", [])
        if pa == pb:
            m["status"] = "draw"
            m["winner"] = ""
            self._save(match_id, m)
            self._payout(str(m["challenger"]), stake)
            self._payout(str(m["opponent"]), stake)
            for b in bets:
                self._payout(str(b["bettor"]), u256(int(b["amount"])))
            return
        winner = str(m["challenger"]) if pa > pb else str(m["opponent"])
        wside = "a" if pa > pb else "b"
        m["status"] = "resolved"
        m["winner"] = winner
        self._save(match_id, m)
        self._payout(winner, stake + stake)
        pool_w = sum(int(b["amount"]) for b in bets if b["side"] == wside)
        pool_t = sum(int(b["amount"]) for b in bets)
        if pool_w > 0:
            for b in bets:
                if b["side"] == wside:
                    amt = u256(int(b["amount"]) * pool_t // pool_w)
                    if amt > u256(0):
                        self._payout(str(b["bettor"]), amt)

    @gl.public.write
    def claim_timeout(self, match_id: u256) -> None:
        m = self._load(match_id)
        stake = u256(int(m["stake"]))
        if m["status"] == "open":
            if self._now() <= int(m["join_deadline"]):
                raise gl.vm.UserError("join still open")
            m["status"] = "cancelled"
            self._save(match_id, m)
            self._payout(str(m["challenger"]), stake)
            for b in m.get("bets", []):
                self._payout(str(b["bettor"]), u256(int(b["amount"])))
            return
        if m["status"] in ("ready", "ongoing"):
            if self._now() <= int(m["expires_at"]):
                raise gl.vm.UserError("match live")
            m["status"] = "refunded"
            self._save(match_id, m)
            self._payout(str(m["challenger"]), stake)
            self._payout(str(m["opponent"]), stake)
            for b in m.get("bets", []):
                self._payout(str(b["bettor"]), u256(int(b["amount"])))
            return
        raise gl.vm.UserError("nothing to claim")
