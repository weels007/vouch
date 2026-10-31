"""Direct mode tests for UnderCollaterizedLending contract."""

import pytest


def test_create_borrower(direct_vm, direct_deploy, direct_alice):
    """Test creating a new borrower profile."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create borrower
    contract.create_borrower("0x1234", 100)

    # Verify
    profile = contract.get_borrower("0x1234")
    assert profile["id"] == "0x1234"
    assert profile["status"] == "active"
    assert profile["reputation"] == 100
    assert profile["total_borrowed"] == 0
    assert profile["total_repaid"] == 0


def test_create_borrower_unknown(direct_vm, direct_deploy, direct_alice):
    """Test getting unknown borrower returns 'unknown' status."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    profile = contract.get_borrower("0x9999")
    assert profile["id"] == "0x9999"
    assert profile["status"] == "unknown"


def test_create_loan(direct_vm, direct_deploy, direct_alice):
    """Test creating a new loan."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create borrower first
    contract.create_borrower("0x1234", 100)

    # Create loan
    loan_id = contract.create_loan("0x1234", 1000, 500)

    # Verify loan
    loan = contract.get_loan(loan_id)
    assert loan["id"] == loan_id
    assert loan["borrower"] == "0x1234"
    assert loan["amount"] == 1000
    assert loan["interest_rate"] == 500
    assert loan["status"] == "pending"


def test_create_loan_unknown_borrower(direct_vm, direct_deploy, direct_alice):
    """Test creating a loan for an unknown borrower."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create loan for unknown borrower
    loan_id = contract.create_loan("0x9999", 1000, 500)

    # Verify loan is still created
    loan = contract.get_loan(loan_id)
    assert loan["borrower"] == "0x9999"
    assert loan["status"] == "pending"


def test_repay_loan(direct_vm, direct_deploy, direct_alice):
    """Test repaying a loan."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create borrower and loan
    contract.create_borrower("0x1234", 100)
    loan_id = contract.create_loan("0x1234", 1000, 500)

    # Repay loan
    contract.repay_loan(loan_id)

    # Verify loan status
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "repaid"


def test_liquidate_loan(direct_vm, direct_deploy, direct_alice):
    """Test liquidating a loan."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create borrower and loan
    contract.create_borrower("0x1234", 100)
    loan_id = contract.create_loan("0x1234", 1000, 500)

    # Liquidate loan
    contract.liquidate_loan(loan_id)

    # Verify loan status
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "liquidated"


def test_get_loan_unknown(direct_vm, direct_deploy, direct_alice):
    """Test getting unknown loan returns 'unknown' status."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    loan = contract.get_loan("loan_9999")
    assert loan["id"] == "loan_9999"
    assert loan["borrower"] == "unknown"
    assert loan["amount"] == 0
    assert loan["status"] == "unknown"


def test_multiple_loans(direct_vm, direct_deploy, direct_alice):
    """Test creating multiple loans."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create borrower
    contract.create_borrower("0x1234", 100)

    # Create multiple loans
    loan_id_1 = contract.create_loan("0x1234", 1000, 500)
    loan_id_2 = contract.create_loan("0x1234", 2000, 750)

    # Verify both loans exist
    loan_1 = contract.get_loan(loan_id_1)
    loan_2 = contract.get_loan(loan_id_2)

    assert loan_1["id"] == loan_id_1
    assert loan_2["id"] == loan_id_2
    assert loan_1["amount"] == 1000
    assert loan_2["amount"] == 2000


def test_loan_id_increment(direct_vm, direct_deploy, direct_alice):
    """Test that loan IDs increment correctly."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    # Create borrower
    contract.create_borrower("0x1234", 100)

    # Create loans and check IDs
    loan_id_1 = contract.create_loan("0x1234", 1000, 500)
    loan_id_2 = contract.create_loan("0x1234", 2000, 750)
    loan_id_3 = contract.create_loan("0x1234", 3000, 1000)

    assert loan_id_1 == "loan_0"
    assert loan_id_2 == "loan_1"
    assert loan_id_3 == "loan_2"