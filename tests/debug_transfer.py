from gltest.direct import VMContext, deploy_contract, create_address
import gltest.direct.wasi_mock as wm

vm = VMContext()
vm.warp("2025-01-01T00:00:00")
alice = create_address("alice")
bob   = create_address("bob")

# Patch gl_call to capture Transfer requests
original_gl_call = wm.gl_call
captured = []

def patched_gl_call(data):
    try:
        from genlayer.py import calldata
        req = calldata.decode(data)
        captured.append(req)
    except Exception:
        pass
    return original_gl_call(data)

wm.gl_call = patched_gl_call

with vm.activate():
    vm.deal(alice, 10**19)
    vm.sender = alice
    vm.value  = 10**18
    c = deploy_contract("contracts/p2p_escrow.py", vm)
    oid = c.post_offer("GEN", "IDR", 15000, 15000, "BCA")
    vm.value = 0

    vm.sender = bob
    vm.mock_web("coingecko.com", {"status": 200, "body": "price 15000"})
    vm.mock_llm("within_limit", '{"market_rate":15000,"deviation_pct":0,"within_limit":true,"reason":"ok"}')
    tid = c.lock_order(oid)

    c.mark_paid(tid, "https://example.com/proof.png")

    vm.sender = alice
    c.release_crypto(tid)

print("Captured gl_calls with Transfer or unknown:")
for req in captured:
    if isinstance(req, dict) and not any(k in req for k in ["RunNondet","GetWebsite","WebRender","ExecPrompt","Return","Rollback","Trace","Sandbox","WebRequest"]):
        print(" ", req)

print("bob balance:", vm._balances.get(bob, 0))
