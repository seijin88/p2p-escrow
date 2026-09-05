from gltest.direct import VMContext, deploy_contract, create_address
import datetime

vm = VMContext()
alice = create_address("alice")
bob   = create_address("bob")

vm.warp("2025-01-01T00:00:00")

with vm.activate():
    vm.deal(alice, 10**19)
    vm.sender = alice
    vm.value  = 10**18
    c = deploy_contract("contracts/p2p_escrow.py", vm)
    oid = c.post_offer("GEN", "IDR", 15000, 15000, "BCA")
    vm.value = 0

    o = c.get_offer(oid)
    print("expires_at:", o.get("expires_at"))

    # warp forward 26h
    vm.warp("2025-01-02T02:00:00")
    print("after warp datetime.now():", datetime.datetime.now(datetime.timezone.utc).timestamp())

    # check _now() in contract
    # post a new offer to see what timestamp it uses
    vm.value = 10**18
    oid2 = c.post_offer("GEN", "IDR", 15000, 15000, "BCA")
    vm.value = 0
    o2 = c.get_offer(oid2)
    print("new offer created_at:", o2.get("created_at"))
    print("expires_at oid1:", o.get("expires_at"))
    print("now > expires_at?", o2.get("created_at", 0) > o.get("expires_at", 0))

    # try expire
    vm.sender = bob
    try:
        c.expire_offer(oid)
        print("expire_offer: SUCCESS")
    except Exception as e:
        print("expire_offer FAILED:", e)
