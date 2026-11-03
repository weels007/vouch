"""Integration tests: deploy the lending contract on a live GenLayer network and
exercise the real consensus lifecycle (credit assessment -> fund -> disburse -> repay).

Run with:
    gltest tests/integration/ -v -s --network studionet
    gltest tests/integration/ -v -s --network localnet

Notes:
- gltest's schema-driven Contract wrapper only works on localnet (schema RPC is
  localnet-only), so these tests talk to the contract through the raw client
  (``read_contract`` / ``write_contract``), which works on every network.
- ``fund_loan`` is payable and requires ``msg.value == amount`` from the borrower
  itself, so the funded wallet from ``../wallet`` is used when available.
"""

import json
import time
from pathlib import Path

import pytest
from eth_account import Account as EthAccount

from gltest import get_contract_factory, get_default_account, get_gl_client
from gltest.accounts import get_accounts
from gltest.assertions import tx_execution_succeeded, tx_execution_failed
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address

PROJECT_ROOT = Path(__file__).resolve().parents[2]
WALLET_DIR = Path(__import__("os").environ.get("VOUCH_WALLET_DIR", PROJECT_ROOT.parent / "wallet"))

BORROW_AMOUNT = 10**16  # 0.01 GEN — keeps payable funding cheap but real
INTEREST_RATE = 500
WAIT_INTERVAL_MS = 3000
FAST_RETRIES = 60  # 3 minutes
CONSENSUS_RETRIES = 120  # 6 minutes — assess_credit runs an LLM consensus round


def _load_wallet(name: str):
    """Decrypt ``<name>-keystore.json`` with ``<name>.password`` from the wallet folder."""
    keystore = WALLET_DIR / f"{name}-keystore.json"
    password_file = WALLET_DIR / f"{name}.password"
    if not keystore.exists() or not password_file.exists():
        raise FileNotFoundError(f"wallet '{name}' not found in {WALLET_DIR}")
    password = password_file.read_text(encoding="utf-8").strip()
    key = EthAccount.decrypt(json.loads(keystore.read_text(encoding="utf-8")), password)
    return EthAccount.from_key(key)


class LiveContract:
    """Minimal schema-free binding: every call goes straight to the network."""

    def __init__(self, address: str, client, account):
        self.address = address
        self.client = client
        self.account = account

    def view(self, method: str, *args):
        last = None
        for attempt in range(5):  # studio occasionally returns 502 / invalid JSON
            try:
                return self.client.read_contract(
                    address=self.address,
                    function_name=method,
                    args=list(args),
                    account=self.account,
                )
            except Exception as exc:  # transport-level only — reads are idempotent
                last = exc
                time.sleep(2 + 2 * attempt)
        raise last

    def write(self, method: str, *args, value: int = 0, retries: int = FAST_RETRIES):
        tx_hash = self.client.write_contract(
            address=self.address,
            function_name=method,
            args=list(args),
            value=value,
            account=self.account,
        )
        last = None
        for attempt in range(6):  # polling may hit transient gateway errors
            try:
                return self.client.wait_for_transaction_receipt(
                    transaction_hash=tx_hash,
                    status=TransactionStatus.ACCEPTED,
                    interval=WAIT_INTERVAL_MS,
                    retries=retries,
                )
            except Exception as exc:
                last = exc
                time.sleep(3 + 3 * attempt)
        raise last


def _execution_output(receipt) -> str:
    """Concatenate leader stdout/stderr so failure codes can be asserted."""
    chunks = []
    try:
        for leader in receipt["consensus_data"]["leader_receipt"]:
            genvm = leader.get("genvm_result") or {}
            chunks.append(str(genvm.get("stdout", "")))
            chunks.append(str(genvm.get("stderr", "")))
    except Exception:
        pass
    return "\n".join(chunks)


def _assert_settled(receipt) -> str:
    """The wait helper also returns on UNDETERMINED (majority disagree) receipts,
    where no state change is ever committed — so settlement must be asserted first."""
    status = receipt.get("status_name")
    assert status in ("ACCEPTED", "FINALIZED"), (
        f"consensus did not settle: status={status} result={receipt.get('result')} "
        f"receipt={receipt}"
    )
    return status


def _assert_settled_success(receipt) -> None:
    _assert_settled(receipt)
    assert tx_execution_succeeded(receipt), receipt


def _assert_settled_failure(receipt) -> None:
    _assert_settled(receipt)
    assert tx_execution_failed(receipt), receipt


def _borrower_address(account) -> str:
    # the contract compares against ``gl.message.sender_address.as_hex.lower()``
    return account.address.lower()


@pytest.fixture(scope="module")
def client():
    return get_gl_client()


@pytest.fixture(scope="module")
def funder():
    """Funded wallet used as borrower/sender (fund_loan moves real value)."""
    try:
        return _load_wallet("tester1")
    except Exception:
        return get_default_account()


@pytest.fixture(scope="module")
def live(client, funder):
    factory = get_contract_factory("UnderCollaterizedLending")
    receipt = factory.deploy_contract_tx(args=[], account=funder)
    _assert_settled_success(receipt)
    address = extract_contract_address(receipt)
    return LiveContract(address, client, funder)


def test_deployed_contract_answers_views(live):
    count = live.view("get_loan_count")
    assert count["count"] == 0, count

    missing = live.view("get_loan", "loan_9999")
    assert missing["status"] == "unknown", missing

    unknown_borrower = live.view("get_borrower", "0x" + "00" * 20)
    assert unknown_borrower["status"] == "unknown", unknown_borrower


def test_register_borrower_and_create_loan(live, client, funder):
    borrower = _borrower_address(funder)

    receipt = live.write("create_borrower", borrower, 700)
    _assert_settled_success(receipt)

    profile = live.view("get_borrower", borrower)
    assert profile["status"] == "active", profile
    assert profile["reputation"] == 700, profile

    before = live.view("get_loan_count")["count"]
    receipt = live.write("create_loan", borrower, BORROW_AMOUNT, INTEREST_RATE)
    _assert_settled_success(receipt)

    loan_id = f"loan_{before}"
    loan = live.view("get_loan", loan_id)
    assert loan["borrower"] == borrower, loan
    assert loan["amount"] == BORROW_AMOUNT, loan
    assert loan["status"] == "pending", loan

    loans = live.view("get_loans")
    assert loan_id in loans, loans


def test_credit_consensus_gates_the_full_lifecycle(live, client, funder):
    """The rejection path that matters: no consensus decision -> funding blocked;
    consensus approval -> fund -> disburse -> repay all execute on-chain."""
    borrower = _borrower_address(funder)
    balance_before = client.get_balance(funder.address)
    if balance_before < BORROW_AMOUNT:
        pytest.skip(f"funder balance {balance_before} < {BORROW_AMOUNT}; cannot move value")

    # borrower must exist and request a loan
    receipt = live.write("create_borrower", borrower, 1000)
    _assert_settled_success(receipt)
    before = live.view("get_loan_count")["count"]
    receipt = live.write("create_loan", borrower, BORROW_AMOUNT, INTEREST_RATE)
    _assert_settled_success(receipt)
    loan_id = f"loan_{before}"

    # the stored decision must start empty — no assessment has run yet
    assert live.view("get_credit_assessment", borrower) == "", "unexpected prior decision"

    # 1) funding without a consensus credit decision must be rejected
    receipt = live.write("fund_loan", loan_id, BORROW_AMOUNT, value=BORROW_AMOUNT)
    _assert_settled_failure(receipt)
    output = _execution_output(receipt)
    if output.strip():
        assert "CREDIT_NOT_ASSESSED" in output, output

    # 2) run the validator-consensus (LLM) credit assessment — real consensus round
    receipt = live.write("assess_credit", borrower, BORROW_AMOUNT, retries=CONSENSUS_RETRIES)
    _assert_settled_success(receipt)

    # the decision is persisted on-chain and readable by the app
    stored = live.view("get_credit_assessment", borrower)
    decision = json.loads(stored)
    assert decision["borrower"] == borrower, decision
    assert decision["amount"] == BORROW_AMOUNT, decision
    assert isinstance(decision["approved"], bool), decision
    assert isinstance(decision["risk_score"], int), decision

    if not decision["approved"]:
        # the LLM round is nondeterministic — re-assess with the same on-chain
        # history before deciding the branch (reputation 1000 should approve)
        live.write("create_borrower", borrower, 1000)
        receipt = live.write(
            "assess_credit", borrower, BORROW_AMOUNT, retries=CONSENSUS_RETRIES
        )
        _assert_settled_success(receipt)
        decision = json.loads(live.view("get_credit_assessment", borrower))
        if not decision["approved"]:
            pytest.skip(f"validator consensus rejected the request: {decision}")

    # 3) with the consensus decision stored, funding with the exact value succeeds
    receipt = live.write("fund_loan", loan_id, BORROW_AMOUNT, value=BORROW_AMOUNT)
    _assert_settled_success(receipt)

    loan = live.view("get_loan", loan_id)
    assert loan["status"] == "funded", loan
    assert loan["deposited"] == BORROW_AMOUNT, loan

    # 4) disburse escrowed capital to the borrower
    receipt = live.write("disburse_loan", loan_id, BORROW_AMOUNT)
    _assert_settled_success(receipt)
    loan = live.view("get_loan", loan_id)
    assert loan["status"] == "active", loan

    # 5) repayment closes the loan
    receipt = live.write("repay_loan", loan_id)
    _assert_settled_success(receipt)
    loan = live.view("get_loan", loan_id)
    assert loan["status"] == "repaid", loan


def test_write_rejections_surface_on_network(live, funder):
    """Deterministic UserError paths stay deterministic under real consensus."""
    borrower = _borrower_address(funder)

    # unknown loan id
    receipt = live.write("repay_loan", "loan_does_not_exist")
    _assert_settled_failure(receipt)
    output = _execution_output(receipt)
    if output.strip():
        assert "LOAN_NOT_FOUND" in output, output

    # zero-amount disbursement on a pending loan is rejected before any transfer
    before = live.view("get_loan_count")["count"]
    receipt = live.write("create_loan", borrower, BORROW_AMOUNT, INTEREST_RATE)
    _assert_settled_success(receipt)
    receipt = live.write("disburse_loan", f"loan_{before}", 0)
    _assert_settled_failure(receipt)
    output = _execution_output(receipt)
    if output.strip():
        assert "LOAN_NOT_FUNDED" in output, output
