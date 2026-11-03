"""Exercise every public method of the *deployed production contract* on studionet
using the real funded wallet, so the explorer records a full transaction history
and we prove the contract actually works on-chain.

    python studionet_methods_test.py

Covers all 14 public methods of UnderCollaterizedLending:

  views  : get_borrower, get_loan, get_credit_assessment, get_credit_assessments,
           get_loan_count, get_borrower_by_sender, get_loans
  writes : create_borrower, create_loan, assess_credit (real LLM consensus),
           fund_loan (payable), disburse_loan, repay_loan, liquidate_loan

Two loans drive the write path:
  loan_0 : create -> assess -> fund -> disburse -> repay   (full lifecycle)
  loan_1 : create -> fund -> disburse -> liquidate          (default path)
"""

import json
import sys
import time

sys.path.insert(0, r"D:\Genlayer-project\weels\wallet")
from deploy import CHAINS, load_account  # noqa: E402

from genlayer_py import create_client  # noqa: E402
from genlayer_py.types import TransactionStatus  # noqa: E402

CONTRACT = "0x1cEF4eaC8afABBc389f538765dA3da5eab885dA4"
AMOUNT = 10**16  # 0.01 GEN — small enough for the rubric, real value anyway
INTEREST = 500
SETTLED = ("ACCEPTED", "FINALIZED")

account = load_account("tester1")
client = create_client(CHAINS["studionet"], account=account)
borrower = account.address.lower()

WRITE_TXS = []  # (method, tx_hash, settled_status)


def read(method: str, *args):
    """View call with retries — studio occasionally returns 502 HTML."""
    last = None
    for _ in range(5):
        try:
            return client.read_contract(
                address=CONTRACT, function_name=method, args=list(args), account=account
            )
        except Exception as exc:
            last = exc
            time.sleep(2)
    raise last


def write(method: str, *args, value: int = 0, retries: int = 150):
    """Write tx that must *settle* through consensus (ACCEPTED/FINALIZED),
    not merely reach the leader's SUCCESS receipt."""
    last = None
    tx = None
    for _ in range(3):
        try:
            tx = client.write_contract(
                address=CONTRACT,
                function_name=method,
                args=list(args),
                value=value,
                account=account,
            )
            receipt = client.wait_for_transaction_receipt(
                transaction_hash=tx,
                status=TransactionStatus.ACCEPTED,
                interval=3000,
                retries=retries,
            )
            break
        except Exception as exc:
            last = exc
            time.sleep(5)
    else:
        raise last

    status = receipt.get("status_name")
    leader = "n/a"
    try:
        leader = receipt["consensus_data"]["leader_receipt"][0]["execution_result"]
    except Exception:
        pass
    assert status in SETTLED, (
        f"{method}: consensus did not settle — status={status} "
        f"result={receipt.get('result')} leader={leader} tx={tx}"
    )
    WRITE_TXS.append((method, tx, status))
    print(f"  [write] {method:22s} {status:9s} tx={tx}")
    return receipt


def main() -> None:
    balance = client.get_balance(account.address)
    print(f"wallet   : {account.address}")
    print(f"balance  : {balance} wei ({balance / 10**18:.4f} GEN)")
    print(f"contract : {CONTRACT}\n")
    assert balance >= 2 * AMOUNT, f"insufficient balance: {balance}"

    print("== stage 0: baseline views (fresh contract) ==")
    count = read("get_loan_count")
    loans = read("get_loans")
    mine = read("get_borrower_by_sender")
    profile = read("get_borrower", borrower)
    decision = read("get_credit_assessment", borrower)
    decisions = read("get_credit_assessments")
    stranger = read("get_borrower", "0x" + "ee" * 20)
    assert count == {"count": 0}, count
    assert loans == {}, loans
    assert mine["status"] == "unknown", mine
    assert profile["status"] == "unknown", profile
    assert decision == "", decision
    assert decisions == {}, decisions
    assert stranger["status"] == "unknown", stranger
    print(f"  get_loan_count={count} get_loans={len(loans)} "
          f"get_borrower_by_sender={mine['status']} get_credit_assessments={decisions}")

    print("\n== write 1: create_borrower ==")
    write("create_borrower", borrower, 1000)
    profile = read("get_borrower", borrower)
    mine = read("get_borrower_by_sender")
    assert profile["status"] == "active" and profile["reputation"] == 1000, profile
    assert mine["reputation"] == 1000, mine
    print(f"  get_borrower={profile['status']} rep={profile['reputation']} "
          f"get_borrower_by_sender={mine['status']}")

    print("\n== write 2: create_loan (loan_0) ==")
    write("create_loan", borrower, AMOUNT, INTEREST)
    count = read("get_loan_count")
    loans = read("get_loans")
    loan0 = read("get_loan", "loan_0")
    assert count == {"count": 1}, count
    assert loan0["status"] == "pending" and loan0["amount"] == AMOUNT, loan0
    assert "loan_0" in loans and loans["loan_0"]["deposited"] == 0, loans
    print(f"  get_loan_count={count} get_loan=loan_0/{loan0['status']} get_loans={list(loans)}")

    print("\n== write 3: assess_credit (real validator-consensus round, ~1-6 min) ==")
    t0 = time.time()
    write("assess_credit", borrower, AMOUNT, retries=200)
    print(f"  consensus settled in {time.time() - t0:.0f}s")
    decision = read("get_credit_assessment", borrower)
    decisions = read("get_credit_assessments")
    parsed = json.loads(decision)
    print(f"  decision: {parsed}")
    assert parsed["borrower"] == borrower and parsed["amount"] == AMOUNT, parsed
    assert isinstance(parsed["approved"], bool), parsed
    assert borrower in decisions, decisions
    assert not read("get_credit_assessment", "0x" + "ab" * 20), "stranger must have no verdict"
    if not parsed["approved"]:
        raise SystemExit(f"REJECTED by quorum — funding gate stays shut: {parsed}")

    print("\n== write 4: fund_loan (payable, exact value) ==")
    write("fund_loan", "loan_0", AMOUNT, value=AMOUNT)
    loan0 = read("get_loan", "loan_0")
    loans = read("get_loans")
    assert loan0["status"] == "funded" and loan0["deposited"] == AMOUNT, loan0
    assert loans["loan_0"]["deposited"] == AMOUNT, loans
    print(f"  get_loan=funded deposited={loan0['deposited']} get_loans[loan_0]={loans['loan_0']['status']}")

    print("\n== write 5: disburse_loan ==")
    write("disburse_loan", "loan_0", AMOUNT)
    loan0 = read("get_loan", "loan_0")
    assert loan0["status"] == "active", loan0
    print(f"  get_loan={loan0['status']}")

    print("\n== write 6: repay_loan (loan_0) ==")
    write("repay_loan", "loan_0")
    loan0 = read("get_loan", "loan_0")
    assert loan0["status"] == "repaid", loan0
    print(f"  get_loan={loan0['status']}")

    print("\n== write 7: create_loan (loan_1, default path) ==")
    write("create_loan", borrower, AMOUNT, INTEREST)
    loan1 = read("get_loan", "loan_1")
    count = read("get_loan_count")
    assert loan1["status"] == "pending", loan1
    assert count == {"count": 2}, count
    print(f"  get_loan=loan_1/{loan1['status']} get_loan_count={count}")

    print("\n== write 8: fund_loan (loan_1) — consensus verdict already on record ==")
    write("fund_loan", "loan_1", AMOUNT, value=AMOUNT)
    assert read("get_loan", "loan_1")["status"] == "funded"
    print("  get_loan=funded")

    print("\n== write 9: disburse_loan (loan_1) ==")
    write("disburse_loan", "loan_1", AMOUNT)
    assert read("get_loan", "loan_1")["status"] == "active"
    print("  get_loan=active")

    print("\n== write 10: liquidate_loan (loan_1) ==")
    write("liquidate_loan", "loan_1")
    loan1 = read("get_loan", "loan_1")
    loans = read("get_loans")
    assert loan1["status"] == "liquidated", loan1
    assert loans["loan_1"]["status"] == "liquidated", loans
    print(f"  get_loan={loan1['status']} get_loans={ {k: v['status'] for k, v in loans.items()} }")

    print("\n== final views ==")
    count = read("get_loan_count")
    decisions = read("get_credit_assessments")
    balance_after = client.get_balance(account.address)
    print(f"  get_loan_count={count} decisions={len(decisions)} "
          f"balance={balance_after / 10**18:.4f} GEN")

    print("\n== SUMMARY ==")
    for method, tx, status in WRITE_TXS:
        print(f"  {method:22s} {status:9s} {tx}")
    views = ("get_borrower", "get_loan", "get_credit_assessment",
             "get_credit_assessments", "get_loan_count",
             "get_borrower_by_sender", "get_loans")
    print(f"\nALL 14 METHODS EXERCISED — 10 writes settled on-chain, "
          f"{len(views)} views verified ({', '.join(views)})")


if __name__ == "__main__":
    main()
