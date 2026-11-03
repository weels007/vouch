# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
from genlayer.py.types import Address, u256
from genlayer.py.storage import TreeMap, DynArray, allow_storage
from genlayer.gl import *
import json
import typing


@gl.evm.contract_interface
class _Escrow:
    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class BorrowerProfile:
    """Profile of a borrower with reputation score."""
    address: str
    reputation: u256
    total_borrowed: u256
    total_repaid: u256
    status: str


@allow_storage
@dataclass
class Loan:
    """Loan details."""
    id: str
    borrower: str
    amount: u256
    interest_rate: u256
    status: str  # pending, funded, active, repaid, defaulted, liquidated
    created_at: str
    due_date: str


@allow_storage
class UnderCollaterizedLending(gl.Contract):
    # Storage fields — typed, persisted on-chain
    borrowers: TreeMap[str, BorrowerProfile]
    loans: TreeMap[str, Loan]
    loan_ids: DynArray[str]
    reputation_scores: TreeMap[str, u256]
    next_loan_id: str
    loan_escrow: TreeMap[str, u256]
    total_held: u256
    total_lent: u256
    total_repaid: u256
    total_refunded: u256
    credit_assessments: TreeMap[str, str]

    def __init__(self):
        # Storage fields are class-level annotations — no manual initialization needed
        self.next_loan_id = "0"
        self.total_held = u256(0)
        self.total_lent = u256(0)
        self.total_repaid = u256(0)
        self.total_refunded = u256(0)

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex.lower()

    @gl.public.view
    def get_borrower(self, borrower: str) -> dict:
        """Get borrower profile by address."""
        profile = self.borrowers.get(borrower)
        if profile is None:
            return {"id": borrower, "status": "unknown"}
        return {
            "id": borrower,
            "status": profile.status,
            "reputation": profile.reputation,
            "total_borrowed": profile.total_borrowed,
            "total_repaid": profile.total_repaid,
        }

    @gl.public.view
    def get_loan(self, loan_id: str) -> dict:
        """Get loan details by ID."""
        loan = self.loans.get(loan_id)
        if loan is None:
            return {"id": loan_id, "borrower": "unknown", "amount": 0, "status": "unknown"}
        return {
            "id": loan.id,
            "borrower": loan.borrower,
            "amount": loan.amount,
            "interest_rate": loan.interest_rate,
            "status": loan.status,
            "created_at": loan.created_at,
            "due_date": loan.due_date,
            "deposited": self.loan_escrow.get(loan_id, u256(0)),
        }

    @gl.public.write
    def create_borrower(self, borrower: str, reputation: u256) -> None:
        """Register a new borrower with initial reputation."""
        self.borrowers[borrower] = BorrowerProfile(
            address=borrower,
            reputation=reputation,
            total_borrowed=0,
            total_repaid=0,
            status="active",
        )

    @gl.public.write
    def create_loan(self, borrower: str, amount: u256, interest_rate: u256) -> str:
        """Create a new loan with specified terms."""
        loan_id = f"loan_{self.next_loan_id}"
        self.next_loan_id = str(int(self.next_loan_id) + 1)
        self.loans[loan_id] = Loan(
            id=loan_id,
            borrower=borrower,
            amount=amount,
            interest_rate=interest_rate,
            status="pending",
            created_at="2026-10-26T00:00:00Z",
            due_date="2027-01-26T00:00:00Z",
        )
        self.loan_ids.append(loan_id)
        return loan_id

    @gl.public.write.payable
    def fund_loan(self, loan_id: str, amount: u256) -> str:
        """Lock GEN into escrow against a loan request (under-collateralized funding)."""
        loan = self.loans.get(loan_id)
        if loan is None:
            raise gl.vm.UserError("LOAN_NOT_FOUND")
        if loan.status != "pending":
            raise gl.vm.UserError("LOAN_NOT_FUNDABLE")
        if amount == u256(0):
            raise gl.vm.UserError("ZERO_FUNDING")
        if self._sender() != loan.borrower:
            raise gl.vm.UserError("NOT_BORROWER")
        assessment = self.credit_assessments.get(loan.borrower)
        if not assessment:
            raise gl.vm.UserError("CREDIT_NOT_ASSESSED")
        if not json.loads(assessment).get("approved", False):
            raise gl.vm.UserError("CREDIT_REJECTED")
        if gl.message.value != amount:
            raise gl.vm.UserError("WRONG_VALUE")
        self.loan_escrow[loan_id] = self.loan_escrow.get(loan_id, u256(0)) + amount
        self.total_held = self.total_held + amount
        loan.status = "funded"
        return "FUNDED"

    @gl.public.write
    def disburse_loan(self, loan_id: str, amount: u256) -> str:
        """Release escrowed GEN to the borrower after funding (capital lent out)."""
        loan = self.loans.get(loan_id)
        if loan is None:
            raise gl.vm.UserError("LOAN_NOT_FOUND")
        if loan.status != "funded":
            raise gl.vm.UserError("LOAN_NOT_FUNDED")
        if amount == u256(0):
            raise gl.vm.UserError("ZERO_DISBURSEMENT")
        if amount > self.loan_escrow.get(loan_id, u256(0)):
            raise gl.vm.UserError("INSUFFICIENT_COLLATERAL")
        if amount > self.total_held:
            raise gl.vm.UserError("INSUFFICIENT_ESCROW")
        self.total_held = self.total_held - amount
        self.total_lent = self.total_lent + amount
        _Escrow(Address(loan.borrower)).emit_transfer(value=amount)
        loan.status = "active"
        return "DISBURSED"

    @gl.public.write
    def assess_credit(self, borrower: str, amount: u256) -> str:
        """Run a validator-consensus (LLM) risk assessment that can gate lending."""
        decision = self._run_credit_consensus(borrower, amount)
        self._store_credit_decision(borrower, decision)
        return decision

    def _run_credit_consensus(self, borrower: str, amount: u256) -> str:
        """Run the validator-consensus NLP assessment via the comparative principle."""
        prompt = (
            "You are the risk validator for an under-collateralized lending protocol. "
            f"Evaluate whether borrower {borrower} may receive a loan of {int(amount)} GEN "
            "based on the attested reputation history and market conditions. "
            "Reply only in JSON format with keys: approved (bool), risk_score (int), reasoning (str)."
        )

        def call_llm() -> str:
            response = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = json.loads(response)
            return json.dumps(
                {
                    "borrower": borrower,
                    "amount": int(amount),
                    "approved": bool(parsed.get("approved", False)),
                    "risk_score": int(parsed.get("risk_score") or 0),
                }
            )

        decision = gl.eq_principle.prompt_comparative(
            call_llm,
            principle="The approved flag and risk_score must be consistent between validators.",
        )
        resolved = decision.get()
        return resolved if isinstance(resolved, str) else json.dumps(resolved)

    def _store_credit_decision(self, borrower: str, decision: str) -> None:
        """Persist the consensus decision."""
        self.credit_assessments[borrower] = decision

    @gl.public.view
    def get_loan_count(self) -> typing.Any:
        """Get total number of loans created."""
        return {"count": int(self.next_loan_id)}

    @gl.public.view
    def get_borrower_by_sender(self) -> typing.Any:
        """Get the caller borrower profile."""
        sender = self._sender()
        profile = self.borrowers.get(sender)
        if profile is None:
            return {"id": sender, "status": "unknown"}
        return {
            "id": sender,
            "status": profile.status,
            "reputation": profile.reputation,
            "total_borrowed": profile.total_borrowed,
            "total_repaid": profile.total_repaid,
        }

    @gl.public.view
    def get_loans(self) -> typing.Any:
        """Get all loan records keyed by loan id."""
        result = {}
        for i in range(int(self.next_loan_id)):
            loan_id = f"loan_{i}"
            loan = self.loans.get(loan_id)
            if loan is None:
                continue
            result[loan_id] = {
                "id": loan.id,
                "borrower": loan.borrower,
                "amount": int(loan.amount),
                "interest_rate": int(loan.interest_rate),
                "status": loan.status,
                "created_at": loan.created_at,
                "due_date": loan.due_date,
                "deposited": int(self.loan_escrow.get(loan_id, u256(0))),
            }
        return result

    @gl.public.write
    def repay_loan(self, loan_id: str) -> None:
        """Mark a loan as repaid; repaid principal returns to escrow."""
        loan = self.loans.get(loan_id)
        if loan is None:
            raise gl.vm.UserError("LOAN_NOT_FOUND")
        if loan.status == "repaid" or loan.status == "liquidated":
            raise gl.vm.UserError("LOAN_TERMINAL")
        self.total_repaid = self.total_repaid + loan.amount
        if loan.status == "funded":
            self.total_held = self.total_held - loan.amount
        loan.status = "repaid"
        self.loan_ids.remove(loan_id)

    @gl.public.write
    def liquidate_loan(self, loan_id: str) -> None:
        """Liquidate a loan (mark as defaulted)."""
        loan = self.loans.get(loan_id)
        if loan is None:
            raise gl.vm.UserError("LOAN_NOT_FOUND")
        if loan.status == "repaid" or loan.status == "liquidated":
            raise gl.vm.UserError("LOAN_NOT_LIQUIDATABLE")
        self.total_refunded = self.total_refunded + loan.amount
        if loan.status == "funded":
            self.total_held = self.total_held - loan.amount
        loan.status = "liquidated"
        self.loan_ids.remove(loan_id)
