"""Direct mode tests for UnderCollaterizedLending contract."""

import json

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


# ------------------------------------------------------------------ #
# Adversarial: consensus-gated credit & revert paths
# ------------------------------------------------------------------ #


def _assert_user_error(exc: Exception, code: str) -> None:
    """Assert that a raised exception carries the expected UserError code."""
    assert code in str(exc), f"expected error code {code!r}, got {exc!r}"


def test_fund_loan_without_credit_assessment_reverts(direct_vm, direct_deploy, direct_alice):
    """Funding must be impossible before any validator consensus ran."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)

    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "CREDIT_NOT_ASSESSED")


def test_fund_loan_after_rejected_consensus_reverts(direct_vm, direct_deploy, direct_alice):
    """An approved=false consensus verdict must permanently block funding."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": false, "risk_score": 95}')

    decision = contract.assess_credit(borrower, 1000)
    assert '"approved": false' in str(decision)

    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "CREDIT_REJECTED")


def test_fund_loan_after_approved_consensus_succeeds(direct_vm, direct_deploy, direct_alice):
    """A final approved consensus verdict must unlock escrow funding."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 5}')

    decision = contract.assess_credit(borrower, 1000)
    assert '"approved": true' in str(decision)

    direct_vm.value = 1000
    result = contract.fund_loan(loan_id, 1000)
    assert str(result) == "FUNDED"
    assert str(contract.get_loan(loan_id)["status"]) == "funded"


def test_fund_loan_by_non_borrower_reverts(direct_vm, direct_deploy, direct_bob, direct_alice):
    """Only the borrower itself may fund its own loan."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_bob
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)

    direct_vm.sender = direct_alice
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "NOT_BORROWER")


def test_fund_loan_unknown_loan_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan("loan_9999", 1000)
    _assert_user_error(excinfo.value, "LOAN_NOT_FOUND")


def test_fund_loan_zero_amount_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 0)
    _assert_user_error(excinfo.value, "ZERO_FUNDING")


def test_fund_loan_wrong_value_reverts(direct_vm, direct_deploy, direct_alice):
    """Escrow must be funded with exactly the assessed amount."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 5}')
    contract.assess_credit(borrower, 1000)
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "WRONG_VALUE")


def test_fund_loan_twice_reverts(direct_vm, direct_deploy, direct_alice):
    """A funded loan can no longer accept a second funding."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 5}')
    contract.assess_credit(borrower, 1000)
    direct_vm.value = 1000
    assert str(contract.fund_loan(loan_id, 1000)) == "FUNDED"
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "LOAN_NOT_FUNDABLE")


def test_disburse_loan_requires_funded_status(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    with pytest.raises(Exception) as excinfo:
        contract.disburse_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "LOAN_NOT_FUNDED")


def test_disburse_loan_zero_amount_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 5}')
    contract.assess_credit(borrower, 1000)
    direct_vm.value = 1000
    assert str(contract.fund_loan(loan_id, 1000)) == "FUNDED"
    with pytest.raises(Exception) as excinfo:
        contract.disburse_loan(loan_id, 0)
    _assert_user_error(excinfo.value, "ZERO_DISBURSEMENT")


def test_disburse_loan_exceeds_escrow_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 5}')
    contract.assess_credit(borrower, 1000)
    direct_vm.value = 1000
    assert str(contract.fund_loan(loan_id, 1000)) == "FUNDED"
    with pytest.raises(Exception) as excinfo:
        contract.disburse_loan(loan_id, 2000)
    _assert_user_error(excinfo.value, "INSUFFICIENT_COLLATERAL")


def test_repay_loan_unknown_loan_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    with pytest.raises(Exception) as excinfo:
        contract.repay_loan("loan_9999")
    _assert_user_error(excinfo.value, "LOAN_NOT_FOUND")


def test_repay_loan_twice_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    contract.repay_loan(loan_id)
    with pytest.raises(Exception) as excinfo:
        contract.repay_loan(loan_id)
    _assert_user_error(excinfo.value, "LOAN_TERMINAL")


def test_repay_liquidated_loan_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    contract.liquidate_loan(loan_id)
    with pytest.raises(Exception) as excinfo:
        contract.repay_loan(loan_id)
    _assert_user_error(excinfo.value, "LOAN_TERMINAL")


def test_liquidate_repaid_loan_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 100)
    loan_id = contract.create_loan(borrower, 1000, 500)
    contract.repay_loan(loan_id)
    with pytest.raises(Exception) as excinfo:
        contract.liquidate_loan(loan_id)
    _assert_user_error(excinfo.value, "LOAN_NOT_LIQUIDATABLE")


def test_liquidate_unknown_loan_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    with pytest.raises(Exception) as excinfo:
        contract.liquidate_loan("loan_9999")
    _assert_user_error(excinfo.value, "LOAN_NOT_FOUND")


# ------------------------------------------------------------------ #
# Consensus decision storage & prompt integrity
# ------------------------------------------------------------------ #


def test_credit_assessment_getter_empty_until_consensus(direct_vm, direct_deploy, direct_alice):
    """The app-facing getter must be empty before consensus and exact after it."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 750)
    contract.create_loan(borrower, 1000, 500)

    assert contract.get_credit_assessment(borrower) == ""
    assert contract.get_credit_assessment("0x" + "ab" * 20) == ""

    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 42}')
    decision = contract.assess_credit(borrower, 1000)

    stored = contract.get_credit_assessment(borrower)
    assert stored == decision
    parsed = json.loads(stored)
    assert parsed["approved"] is True
    # risk_score is derived on-chain (reputation 750 -> 100 - 75), never taken from
    # the free-form LLM answer, so validators compare only the approved verdict
    assert parsed["risk_score"] == 25
    assert parsed["borrower"] == borrower
    assert parsed["amount"] == 1000


def test_assess_prompt_uses_gen_units_and_onchain_reputation(direct_vm, direct_deploy, direct_alice):
    """The risk prompt must show a human-scale loan size plus the on-chain history
    instead of raw wei (previously: '10000000000000000 GEN', which made validators
    reject every realistic request)."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 750)
    contract.create_loan(borrower, 10**16, 500)  # 0.01 GEN in wei

    seen_prompts = []
    original_match = direct_vm._match_llm_mock

    def _spy(prompt: str):
        seen_prompts.append(prompt)
        return original_match(prompt)

    direct_vm._match_llm_mock = _spy
    try:
        direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 7}')
        contract.assess_credit(borrower, 10**16)
    finally:
        direct_vm._match_llm_mock = original_match

    assert seen_prompts, "the risk validator prompt was never captured"
    prompt = seen_prompts[0]

    # loan size in GEN units, not raw wei
    assert f"{10**16} GEN" not in prompt, prompt
    assert "10 milli-GEN" in prompt, prompt

    # the attested on-chain history actually reaches the validator
    assert "reputation 750" in prompt, prompt
    assert "status active" in prompt, prompt
    assert borrower in prompt, prompt
