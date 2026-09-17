"""
Deploy p2p_escrow_deploy.py to Bradbury using genlayer-py 0.16.3.
This replicates what the GenLayer Studio does internally.

Usage:
    py -3.12 scripts/deploy_to_bradbury.py
"""
from genlayer import *
from genlayer_py.accounts import create_account
import sys

RPC      = "https://rpc-bradbury.genlayer.com"
CHAIN_ID = 4221
CODE_FILE = "contracts/p2p_escrow_deploy.py"

# ── Load wallet ──────────────────────────────────────────────────────────────
pk = input("Paste private key (0x…): ").strip()
if not pk.startswith("0x") or len(pk) != 66:
    sys.exit("Invalid private key format")

account = create_account(private_key=pk)

# ── Configure client ─────────────────────────────────────────────────────────
gl.config(rpc_url=RPC, chain_id=CHAIN_ID)

# ── Read contract source ─────────────────────────────────────────────────────
with open(CODE_FILE, "r", encoding="utf-8") as f:
    code = f.read()

print(f"Account : {account.address}")
print(f"Contract: {CODE_FILE}")
print(f"Size    : {len(code):,} chars")

# ── Simulate first to catch revert reasons early ─────────────────────────────
print("\nSimulating deploy…")
try:
    tx_id = gl.deploy(
        code,
        account=account,
    )
    print(f"Deploy tx: {tx_id}")
    print("Deploy successful!")
except Exception as e:
    print(f"Deploy failed: {e}")
    sys.exit(1)