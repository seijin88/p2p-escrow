"""
Integration tests for P2P Escrow Contract.
Run with: gltest testnet_bradbury tests/integration/
"""
from pathlib import Path
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

# Use absolute path to the repo root
ROOT = Path(__file__).parent.parent
CONTRACT_PATH = ROOT / "contracts" / "p2p_escrow_studio.py"

def test_contract_file_validation():
    """Verify the contract file has valid syntax and required attributes."""
    import ast
    assert CONTRACT_PATH.exists(), f"Contract file not found: {CONTRACT_PATH}"
    
    with open(CONTRACT_PATH, 'r') as f:
        source = f.read()
    
    tree = ast.parse(source)
    first_line = source.split('\n')[0].strip()
    
    assert "py-genlayer:1jb45aa8" in first_line
    assert "py-genlayer:test" not in first_line
    assert "py-genlayer:latest" not in first_line
    
    forbidden = ['import os', 'import sys', 'import subprocess', 'import random']
    for f in forbidden:
        assert f not in source
    
    print("✓ Contract file validation passed!")

def test_contract_factory():
    """Test loading the contract factory."""
    factory = get_contract_factory("p2p_escrow_studio")
    print("✓ Contract factory loaded!")

def test_full_flow():
    """Full test: deploy -> create_offer -> lock -> release."""
    factory = get_contract_factory("p2p_escrow_studio")
    
    # Deploy
    contract = factory.deploy()
    print("✓ Contract deployed!")
    
    # Create offer
    receipt = contract.create_offer(
        args=["GEN", "IDR", "150000", "5000", "Transfer"],
        value=1000000000000000000  # 1 GEN
    ).transact()
    assert tx_execution_succeeded(receipt), f"create_offer failed: {receipt}"
    print("✓ Offer created!")
    
    # Lock order
    receipt = contract.lock_order(args=[0]).transact()
    assert tx_execution_succeeded(receipt), f"lock_order failed: {receipt}"
    print("✓ Order locked!")
    
    # Release
    receipt = contract.release_crypto(args=[0]).transact()
    assert tx_execution_succeeded(receipt), f"release_crypto failed: {receipt}"
    print("✓ Crypto released!")

if __name__ == "__main__":
    test_contract_file_validation()
    test_contract_factory()
    # test_full_flow()  # Requires funded account on testnet
