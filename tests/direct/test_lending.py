"""Direct mode tests for UnderCollaterizedLending contract."""

import json
from pathlib import Path

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


# ------------------------------------------------------------------ #
# Full public-API coverage: bulk views, sender views, disbursement
# ------------------------------------------------------------------ #


def test_get_loan_count_tracks_creations(direct_vm, direct_deploy, direct_alice):
    """get_loan_count starts at zero and increments with every created loan."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice

    assert contract.get_loan_count() == {"count": 0}

    contract.create_borrower("0x1234", 100)
    contract.create_loan("0x1234", 1000, 500)
    contract.create_loan("0x1234", 2000, 750)
    contract.create_loan("0x1234", 3000, 1000)

    assert contract.get_loan_count() == {"count": 3}


def test_get_loans_returns_all_records(direct_vm, direct_deploy, direct_alice):
    """get_loans exposes every loan with escrow accounting, keyed by loan id."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    contract.create_borrower("0x1234", 100)
    contract.create_loan("0x1234", 1000, 500)
    contract.create_loan("0x5678", 2000, 750)

    loans = contract.get_loans()
    assert set(loans) == {"loan_0", "loan_1"}, loans

    first = loans["loan_0"]
    assert first["id"] == "loan_0"
    assert first["borrower"] == "0x1234"
    assert first["amount"] == 1000
    assert first["interest_rate"] == 500
    assert first["status"] == "pending"
    assert first["deposited"] == 0
    assert first["created_at"] and first["due_date"]

    second = loans["loan_1"]
    assert second["borrower"] == "0x5678"
    assert second["amount"] == 2000
    assert second["interest_rate"] == 750


def test_get_borrower_by_sender(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The sender-scoped view resolves the caller profile (unknown until registered)."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")

    # unknown caller: id echoes the sender, no profile
    direct_vm.sender = direct_alice
    unknown = contract.get_borrower_by_sender()
    assert unknown["status"] == "unknown"
    assert unknown["id"] == contract._sender()

    # register the caller and the view must reflect it immediately
    contract.create_borrower(contract._sender(), 700)
    profile = contract.get_borrower_by_sender()
    assert profile["status"] == "active"
    assert profile["reputation"] == 700
    assert profile["total_borrowed"] == 0
    assert profile["total_repaid"] == 0

    # a different sender still sees their own (unknown) profile
    direct_vm.sender = direct_bob
    other = contract.get_borrower_by_sender()
    assert other["status"] == "unknown"
    assert other["id"] != profile["id"]


def test_get_credit_assessments_bulk(direct_vm, direct_deploy, direct_alice):
    """The bulk decision view is empty before consensus and keyed by borrower after."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 750)

    # no loans -> no decisions to surface
    assert contract.get_credit_assessments() == {}

    contract.create_loan(borrower, 1000, 500)
    # decision exists in storage but has no consensus verdict yet
    assert contract.get_credit_assessment(borrower) == ""

    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 42}')
    contract.assess_credit(borrower, 1000)

    decisions = contract.get_credit_assessments()
    assert list(decisions) == [borrower], decisions
    parsed = json.loads(decisions[borrower])
    assert parsed["approved"] is True
    assert parsed["risk_score"] == 25  # deterministic: 100 - 750//10
    assert parsed["borrower"] == borrower
    assert parsed["amount"] == 1000

    # borrowers without a loan never appear in the bulk view
    contract.create_borrower("0x" + "cd" * 20, 900)
    assert "0x" + "cd" * 20 not in contract.get_credit_assessments()


def test_disburse_loan_lifecycle(direct_vm, direct_deploy, direct_alice):
    """Happy path: assess -> fund -> disburse moves the loan to active with escrow held."""
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 800)
    loan_id = contract.create_loan(borrower, 1000, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true, "risk_score": 5}')
    contract.assess_credit(borrower, 1000)

    direct_vm.value = 1000
    assert str(contract.fund_loan(loan_id, 1000)) == "FUNDED"
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "funded"
    assert loan["deposited"] == 1000

    direct_vm.value = 0
    assert str(contract.disburse_loan(loan_id, 1000)) == "DISBURSED"
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "active"
    assert loan["deposited"] == 1000  # escrow accounting stays auditable

    # the bulk view reflects the disbursed state for the app
    loans = contract.get_loans()
    assert loans[loan_id]["status"] == "active"
    assert loans[loan_id]["deposited"] == 1000


# ------------------------------------------------------------------ #
# Steward critique: the consensus verdict must actually drive lending
# ------------------------------------------------------------------ #


def test_consensus_verdict_is_the_lending_switch(direct_vm, direct_deploy, direct_alice):
    """A rejected quorum verdict blocks escrow; re-assessing to approved unlocks it.

    This is the GenLayer steward's core requirement: a non-deterministic
    consensus round whose outcome — not the raw call — decides whether capital
    can be locked, and the app can read that outcome back from storage.
    """
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    contract.create_borrower(borrower, 300)
    loan_id = contract.create_loan(borrower, 1000, 500)

    # 1) quorum rejects -> funding refused, no escrow moved
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": false}')
    decision = contract.assess_credit(borrower, 1000)
    assert json.loads(decision)["approved"] is False
    direct_vm.value = 1000
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1000)
    _assert_user_error(excinfo.value, "CREDIT_REJECTED")
    assert contract.get_loan(loan_id)["status"] == "pending"
    assert contract.get_loan(loan_id)["deposited"] == 0

    # 2) quorum approves on reassessment -> the same call now succeeds
    direct_vm.clear_mocks()  # first-match-wins: drop the rejected verdict mock
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true}')
    decision = contract.assess_credit(borrower, 1000)
    assert json.loads(decision)["approved"] is True
    assert str(contract.fund_loan(loan_id, 1000)) == "FUNDED"
    assert contract.get_loan(loan_id)["status"] == "funded"

    # 3) the settled verdict is readable by the frontend through both getters
    parsed = json.loads(contract.get_credit_assessment(borrower))
    assert parsed["approved"] is True
    assert borrower in contract.get_credit_assessments()


# ------------------------------------------------------------------ #
# Steward follow-up: one base-unit convention across the whole flow
# ------------------------------------------------------------------ #

GEN = 10**18


def to_base_units(gen: str) -> int:
    """Mirror of the frontend ``toBaseUnits`` (lib/genlayer.ts).

    The UI is the only place that ever sees human GEN strings; every contract
    method argument and the attached ``msg.value`` are base units (wei).
    """
    import re

    if not re.fullmatch(r"\d+(\.\d+)?|\.\d+", gen.strip()):
        raise ValueError(f'Invalid GEN amount: "{gen}"')
    whole, _, frac = gen.strip().partition(".")
    return int(whole or "0") * GEN + int((frac + "0" * 18)[:18])


def test_to_base_units_matches_frontend_conversion():
    """The GEN->wei helper used by the UI must agree with on-chain base units."""
    assert to_base_units("1") == 10**18
    assert to_base_units("0.01") == 10**16
    assert to_base_units(".5") == 5 * 10**17
    assert to_base_units("100") == 100 * 10**18
    assert to_base_units("0") == 0
    with pytest.raises(ValueError):
        to_base_units("abc")
    with pytest.raises(ValueError):
        to_base_units("1.2.3")


def test_end_to_end_assessment_to_disbursement_in_base_units(direct_vm, direct_deploy, direct_alice):
    """Corrected flow: assessment -> creation -> funding -> disbursement all in wei.

    One convention, end to end: the amount the user types as ``"1"`` GEN is
    converted once at the UI boundary (``toBaseUnits``) and then travels as
    ``10**18`` wei through ``create_loan``, ``assess_credit``, ``fund_loan``
    (both the argument *and* the attached value) and ``disburse_loan`` — so the
    contract's ``gl.message.value != amount`` check passes instead of reverting.
    """
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    amount = to_base_units("1")  # what the UI sends for an input of "1" GEN

    # borrower profile: reputation 800 satisfies the consensus rubric (>= 600)
    contract.create_borrower(borrower, 800)

    # 1) loan creation in base units
    loan_id = contract.create_loan(borrower, amount, 500)
    assert contract.get_loan(loan_id)["amount"] == amount

    # 2) consensus assessment in base units (prompt still shows human GEN)
    seen_prompts = []
    original_match = direct_vm._match_llm_mock
    direct_vm._match_llm_mock = lambda p: (seen_prompts.append(p), original_match(p))[1]
    try:
        direct_vm.mock_llm(r".*risk validator.*", '{"approved": true}')
        decision = contract.assess_credit(borrower, amount)
    finally:
        direct_vm._match_llm_mock = original_match

    assert json.loads(decision)["amount"] == amount
    assert "1 GEN and 0 milli-GEN" in seen_prompts[0], seen_prompts[0]
    assert f"{amount} GEN" not in seen_prompts[0]

    # 3) funding: argument and attached value share the same wei figure
    direct_vm.value = amount
    assert str(contract.fund_loan(loan_id, amount)) == "FUNDED"
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "funded"
    assert loan["deposited"] == amount

    # 4) disbursement releases exactly the escrowed base units
    direct_vm.value = 0
    assert str(contract.disburse_loan(loan_id, amount)) == "DISBURSED"
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "active"
    assert loan["deposited"] == amount

    # 5) lifecycle closes in the same unit
    contract.repay_loan(loan_id)
    assert contract.get_loan(loan_id)["status"] == "repaid"

    # the whole ledger is base units all the way through
    loans = contract.get_loans()
    assert loans[loan_id]["amount"] == amount
    assert loans[loan_id]["deposited"] == amount


def test_fund_loan_whole_gen_args_with_wei_value_reverts(direct_vm, direct_deploy, direct_alice):
    """Regression for the reported bug: mixed units must never fund a loan.

    Passing a whole-GEN method argument (``1``) while attaching a wei-scaled
    value (``10**18``) is exactly the mismatch that made the old frontend
    revert with WRONG_VALUE; the contract keeps rejecting any such pair.
    """
    contract = direct_deploy("contracts/UnderCollaterizedLending.py")
    direct_vm.sender = direct_alice
    borrower = contract._sender()
    amount = to_base_units("1")
    contract.create_borrower(borrower, 800)
    loan_id = contract.create_loan(borrower, amount, 500)
    direct_vm.mock_llm(r".*risk validator.*", '{"approved": true}')
    contract.assess_credit(borrower, amount)

    # whole-GEN argument + wei-scaled attached value -> WRONG_VALUE
    direct_vm.value = amount
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, 1)
    _assert_user_error(excinfo.value, "WRONG_VALUE")

    # the mirror mistake (wei argument + GEN-scaled value) is refused too
    direct_vm.value = 1  # a whole-GEN value attached against a wei argument
    with pytest.raises(Exception) as excinfo:
        contract.fund_loan(loan_id, amount)
    _assert_user_error(excinfo.value, "WRONG_VALUE")

    # the loan is untouched: still pending, no escrow locked
    loan = contract.get_loan(loan_id)
    assert loan["status"] == "pending"
    assert loan["deposited"] == 0


def test_frontend_source_uses_single_base_unit_convention():
    """The shipped UI source must keep one convention: GEN is converted once.

    Guards the steward-reported regression directly in source: ``fund_loan``
    attaches ``amount`` verbatim (never re-scales it), and every handler
    converts the typed GEN string through ``toBaseUnits`` before it reaches a
    method argument.
    """
    root = Path(__file__).resolve().parents[2]
    lib = (root / "frontend" / "lib" / "genlayer.ts").read_text(encoding="utf-8")
    actions = (root / "frontend" / "components" / "LoanActions.tsx").read_text(encoding="utf-8")
    dashboard = (root / "frontend" / "app" / "dashboard" / "page.tsx").read_text(encoding="utf-8")

    # fund_loan: value is the wei argument itself, not a second scaling
    assert "value: amount * GEN_UNIT" not in lib
    assert "export function toBaseUnits" in lib
    assert "export function formatBaseUnits" in lib

    # every amount that reaches a contract method goes through toBaseUnits
    assert actions.count("toBaseUnits(amount)") == 4  # assess, create, fund, disburse
    # and wei read back from chain is rendered through formatBaseUnits
    assert "formatBaseUnits(decision.amount)" in actions
    assert "formatBaseUnits(decision.amount ?? 0)" in dashboard
    assert "formatBaseUnits(loan.amount ?? 0)" in dashboard
