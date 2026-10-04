#!/usr/bin/env python3
"""Agent-vs-agent demo player for ArenaDebat (contracts/arena_debat.py).

The user only registers wallets and picks a topic; two agents (wallet A and
wallet B) then play a full match autonomously: create -> join -> submit
arguments (LLM or static file) -> resolve rounds -> final.

Keys are NEVER hardcoded. Provide them via environment:
    ARENA_KEY_A   private key of debater A (challenger)
    ARENA_KEY_B   private key of debater B (opponent)
    ARENA_CONTRACT  deployed ArenaDebat address (or --contract)
    OPENAI_API_KEY  optional; without it use --a-file/--b-file static texts
    OPENAI_BASE_URL optional (default https://api.openai.com/v1)
    OPENAI_MODEL    optional (default gpt-4o-mini)

Example:
    set ARENA_KEY_A=... & set ARENA_KEY_B=... & set ARENA_CONTRACT=0x...
    py -3.12 scripts/agent_arena.py --topic "Nasi goreng vs mie goreng" --stake-gen 1
"""

import argparse
import json
import os
import sys
import time
import urllib.request

from genlayer_py import create_account, create_client
from genlayer_py.chains import testnet_bradbury

ROUNDS = 3


def log(*a):
    print("[arena-agent]", *a, flush=True)


def llm_argument(topic, side, history, model, base_url, api_key):
    other = "B" if side == "A" else "A"
    prompt = (
        f"You are debater side {side} in a fun Indonesian debate on: {topic}. "
        f"Previous arguments: {history or '-'}. "
        f"Attack side {other}'s points, defend your side. "
        "Reply with ONE argument, max 600 characters, Bahasa Indonesia."
    )
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
    }).encode()
    req = urllib.request.Request(
        base_url.rstrip("/") + "/chat/completions",
        data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode())
    return data["choices"][0]["message"]["content"].strip()[:900]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--contract", default=os.environ.get("ARENA_CONTRACT", ""))
    ap.add_argument("--topic", required=True)
    ap.add_argument("--stake-gen", type=float, default=1.0)
    ap.add_argument("--a-file", default="")
    ap.add_argument("--b-file", default="")
    args = ap.parse_args()

    key_a = os.environ.get("ARENA_KEY_A", "").strip()
    key_b = os.environ.get("ARENA_KEY_B", "").strip()
    if not (key_a and key_b and args.contract):
        sys.exit("Need ARENA_KEY_A, ARENA_KEY_B and --contract (or ARENA_CONTRACT).")
    stake = int(args.stake_gen * 10**18)

    static = {}
    for side, path in (("A", args.a_file), ("B", args.b_file)):
        if path:
            with open(path, encoding="utf-8") as f:
                static[side] = [l.strip() for l in f if l.strip()]
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").strip()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()

    acct_a = create_account(key_a)
    acct_b = create_account(key_b)
    client = create_client(chain=testnet_bradbury, account=acct_a)
    C = args.contract

    def read(fn, fn_args=None):
        return client.read_contract(address=C, function_name=fn, args=fn_args or [])

    def wait_status(mid, want, timeout_s=2400, interval=60):
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            m = json.loads(read("get_match", [mid]))
            if m["status"] in want:
                return m
            time.sleep(interval)
        raise TimeoutError(f"match {mid} never reached {want}")

    def wait_round(mid, r, timeout_s=2400, interval=60):
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            m = json.loads(read("get_match", [mid]))
            if m["rounds"][r]["done"]:
                return m
            time.sleep(interval)
        raise TimeoutError(f"round {r} never resolved")

    def make_text(side, r, history):
        if static.get(side):
            return static[side][r % len(static[side])][:900]
        if not api_key:
            sys.exit(f"No text for side {side}: set OPENAI_API_KEY or --{side.lower()}-file.")
        return llm_argument(args.topic, side, history, model, base_url, api_key)

    before = int(read("get_match_count"))
    log("create_match:", args.topic)
    client.write_contract(address=C, function_name="create_match",
                          account=acct_a, value=stake, args=[args.topic])
    mid = int(read("get_match_count")) - 1
    assert mid >= before, "match counter did not move"
    log("match id:", mid)

    log("join_match (B)")
    client.write_contract(address=C, function_name="join_match",
                          account=acct_b, value=stake, args=[mid])

    history = ""
    for r in range(ROUNDS):
        for side, acct in (("A", acct_a), ("B", acct_b)):
            text = make_text(side, r, history)
            log(f"round {r} side {side}: {text[:80]}...")
            client.write_contract(address=C, function_name="submit_argument",
                                  account=acct, args=[mid, text])
        log(f"resolve_round {r}")
        client.write_contract(address=C, function_name="resolve_round",
                              account=acct_a, args=[mid, r])
        m = wait_round(mid, r)
        rr = m["rounds"][r]
        history += f" [R{r} A:{rr['score_a']} B:{rr['score_b']}]"
        log(f"round {r} scored A={rr['score_a']} B={rr['score_b']}")

    log("resolve_final")
    client.write_contract(address=C, function_name="resolve_final",
                          account=acct_a, args=[mid])
    m = wait_status(mid, ("resolved", "draw"))
    log("FINAL:", m["status"], "winner:", m.get("winner") or "- (draw)")
    log("done. explorer: https://explorer-bradbury.genlayer.com/address/" + C)


if __name__ == "__main__":
    main()
