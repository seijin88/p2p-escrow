from pathlib import Path
from gltest.assertions import tx_execution_succeeded
from gltest import get_contract_factory

def test_contract_file_validation():
    """Verify the contract file has valid syntax and required attributes."""
    import ast
    
    CONTRACT_PATH = Path(__file__).parent.parent / "contracts" / "p2p_escrow_studio.py"
    
    # Check if file exists
    assert CONTRACT_PATH.exists(), f"Contract file not found: {CONTRACT_PATH}"
    
    # Parse and validate syntax
    with open(CONTRACT_PATH, 'r') as f:
        source = f.read()
    
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise AssertionError(f"Contract has syntax errors: {e}")
    
    # Check for required runner version
    lines = source.split('\n')
    first_line = lines[0].strip()
    
    # Validate runner version is pinned (not test/latest)
    assert "py-genlayer:1jb45aa8" in first_line, f"Runner version not pinned correctly: {first_line}"
    assert "py-genlayer:test" not in first_line, "Runner version uses 'test' (forbidden)"
    assert "py-genlayer:latest" not in first_line, "Runner version uses 'latest' (forbidden)"
    
    # Check for forbidden imports
    forbidden_imports = ['import os', 'import sys', 'import subprocess', 'import random']
    for forbidden in forbidden_imports:
        assert forbidden not in source, f"Forbidden import found: {forbidden}"
    
    print("Contract file syntax and runner validation passed!")

if __name__ == "__main__":
    test_contract_file_validation()
