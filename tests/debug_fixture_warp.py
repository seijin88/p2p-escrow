"""Run as: python -m pytest tests/debug_fixture_warp.py -v -s"""
import datetime

def test_warp_works_in_fixture(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/p2p_escrow.py")
    
    t1 = datetime.datetime.now(datetime.timezone.utc).timestamp()
    print(f"\nbefore warp: {t1}")
    
    direct_vm.warp("2025-01-02T02:00:00")
    
    t2 = datetime.datetime.now(datetime.timezone.utc).timestamp()
    print(f"after warp: {t2}")
    
    assert t2 > t1, f"warp did not work: {t1} -> {t2}"
    print("warp WORKS!")
