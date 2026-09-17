"""
Direct deploy + post_offer test using genlayer-py SDK.
This replicates exactly what GenLayer Studio does.
"""
import sys
from genlayer import *
from genlayer_py.accounts import create_account

RPC      = "https://rpc-bradbury.genlayer.com"
CHAIN_ID = 4221
CODE_FILE = "contracts/p2p_escrow_deploy.py"

pk = input("Private key (0x...): ").strip()
if not pk.startswith("0x") or len(pk) not in (66, 64):
    sys.exit("Invalid key")

account = create_account(private_key=pk)

gl.config(rpc_url=RPC, chain_id=CHAIN_ID)

# 1. Deploy
with open(CODE_FILE) as f:
    code = f.read()

print(f"Account  : {account.address}")
print(f"Code size: {len(code):,} chars")
print("\nDeploying…")

try:
    tx_id = gl.deploy(code, account=account)
    print(f"Deploy OK: {tx_id}")
except Exception as e:
    print(f"Deploy FAILED: {e}")
    sys.exit(1)

# 2. Get contract address
receipt = gl.get_transaction_receipt(tx_id)
deployed_addr = receipt.get("contract_address") or \
    gl.provider.make_request("gen_getContractAddress", [tx_id])["result"]
print(f"Contract : {deployed_addr}")

# 3. Report profile first
print("\nReporting profile…")
try:
    gl.call(deployed_addr, "report_profile",
            args=["BCA", "1234567890", "Alice Seller"],
            account=account)
    print("  profile OK")
except Exception as e:
    print(f"  profile FAILED: {e}")

# 4. post_offer
print("\nPosting offer (1 GEN)…")
try:
    tx_id2 = gl.send(
        deployed_addr,
        "post_offer",
        args=["GEN", "1", 14500, 14500, "DANA"],
        account=account,
        value=1_000_000_000_000_000_000,  # 1 GEN in wei
    )
    print(f"  offer OK: {tx_id2}")
    # Wait for finalization
    print("  Waiting for finalization…")
    final = gl.wait_for_finalization(tx_id2)
    print(f"  Finalized! Status: {final.get('status')}")
except Exception as e:
    print(f"  offer FAILED: {e}")

print("\nDone.")