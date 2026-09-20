import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

@pytest.fixture
def factory():
    return get_contract_factory("P2PEscrow")

def test_contract_file_validation(factory):
    """Test that the contract file can be loaded and validated."""
    # Just getting the factory validates the contract file syntax and schema
    assert factory is not None
    print("Contract file loaded and validated successfully")

def test_01_deploy(factory):
    """Test contract deployment on testnet."""
    receipt = factory.deploy().transact()
    assert tx_execution_succeeded(receipt), "Deployment failed"
    print(f"Contract deployed at: {receipt.contract_address}")

def test_02_register_profile(contract):
    """Test profile registration."""
    receipt = contract.register_profile(
        args=["Bank BCA", "User Name", "123456789012"]
    ).transact()
    assert tx_execution_succeeded(receipt), "Profile registration failed"

def test_03_create_offer(contract):
    """Test creating an offer."""
    receipt = contract.create_offer(
        args=[1000000000000000000, 150000, "IDR"]
    ).transact()
    assert tx_execution_succeeded(receipt), "Create offer failed"

def test_04_get_profile(contract):
    """Test retrieving profile."""
    result = contract.get_profile(args=[]).call()
    print(f"Profile: {result}")

def test_05_get_offers(contract):
    """Test retrieving offers."""
    result = contract.get_offers(args=[]).call()
    print(f"Offers: {result}")
