# Steward Requests & Fixes

Track record of every GenLayer Studio steward review on this project, the root
cause found, and the fix that was shipped.

---

## Request #2 — Mixed unit convention in the funding flow (current)

### Steward request

> The funding flow currently passes whole-GEN method arguments while attaching a
> wei-scaled value, so the contract's value check reverts. Please use one
> consistent base-unit convention across assessment, loan creation, funding,
> disbursement, and the attached value, then add an end-to-end source test
> showing the corrected assessment-to-disbursement flow.

### Root cause

`frontend/lib/genlayer.ts` → `writeFundLoan` mixed two units in one call:

```ts
args: [loanId, amount],        // amount = raw input, treated as whole GEN
value: amount * GEN_UNIT,      // value scaled to wei
```

The contract checks `gl.message.value != amount` (`contracts/UnderCollaterizedLending.py:153`),
so `100e18 != 100` → `WRONG_VALUE` revert. Every funding attempt from the UI
failed at the escrow step.

The same raw-value leak existed upstream: `runCredit`, `runCreateLoan`,
`runFundLoan` and `runDisburseLoan` all did `BigInt(amount)` on the typed GEN
string, so assessment, creation, funding and disbursement args were whole-GEN
while `msg.value` was wei.

### Fix — one convention: base units (wei) everywhere

GEN is now converted **once**, at the UI boundary; nothing inside a method
argument or `msg.value` is ever scaled again.

| Layer | Change |
|---|---|
| `frontend/lib/genlayer.ts` | New `toBaseUnits(gen)` (GEN string → wei, validates input, accepts decimals) and `formatBaseUnits(value)` (wei → GEN display). `writeFundLoan` now sends `value: amount` (verbatim wei, no second scaling). Docstrings on `writeAssessCredit`, `writeCreateLoan`, `writeFundLoan`, `writeDisburseLoan` state the wei convention. |
| `frontend/components/LoanActions.tsx` | All four handlers convert with `toBaseUnits(amount)` before calling the contract. Amount inputs accept decimals (`inputMode="decimal"`, decimal-safe `onChange`). Default amount changed `100` → `1` GEN (rubric caps requests at 100 GEN). On-record assessed amount renders via `formatBaseUnits`. |
| `frontend/app/dashboard/page.tsx` | `decision.amount`, `loan.amount`, `total_borrowed`, `total_repaid` all render through `formatBaseUnits` (previously raw wei printed as "GEN"). Added a `vouch:profile-changed` listener so a settled registration refreshes the profile/ledger without a manual reload. |
| Wallet onboarding | "Register borrower" button added to `LoanActions` (`writeCreateBorrower(..., 800)`) — a fresh wallet reads `status unknown`, which the consensus rubric rejects; registering first keeps the steward's verification path green. |
| Types | `CreditDecision.amount`, `LoanRecord.amount/deposited`, `total_borrowed/repaid` widened to `number \| string` (wei exceeds `Number.MAX_SAFE_INTEGER`). |

Contract side needed no change — it already takes base units and enforces
`gl.message.value == amount`.

### End-to-end source tests added (`tests/direct/test_lending.py`)

1. **`test_to_base_units_matches_frontend_conversion`** — the UI helper's GEN→wei
   conversion (`"1"` → `10**18`, `"0.01"` → `10**16`, `".5"` → `5·10**17`) plus
   malformed-input rejection.
2. **`test_end_to_end_assessment_to_disbursement_in_base_units`** — the corrected
   assessment→disbursement flow the steward asked for: `create_borrower` →
   `create_loan(wei)` → `assess_credit(wei)` (prompt still says "1 GEN and
   0 milli-GEN", not raw wei) → `fund_loan(args=wei, value=wei)` →
   `disburse_loan(wei)` → `repay`, asserting every stored figure stays in wei.
3. **`test_fund_loan_whole_gen_args_with_wei_value_reverts`** — regression for
   the exact reported bug: whole-GEN arg + wei value → `WRONG_VALUE`, the mirror
   mistake is refused too, and the loan stays `pending` with `deposited == 0`.
4. **`test_frontend_source_uses_single_base_unit_convention`** — guards the
   shipped UI source directly: forbids `value: amount * GEN_UNIT`, requires
   `toBaseUnits` in all four handlers and `formatBaseUnits` on every read-back.

### Status

- [x] `toBaseUnits` / `formatBaseUnits` in `lib/genlayer.ts`, `writeFundLoan` value fixed
- [x] All four LoanActions handlers convert via `toBaseUnits`, decimal inputs
- [x] Dashboard wei→GEN formatting + profile-change refresh listener
- [x] Register-borrower onboarding button
- [x] Four new tests (conversion, e2e flow, regression, source guard)
- [x] `pytest tests/direct/ -q` green — **37 passed** (33 existing + 4 new)
- [x] `npx tsc --noEmit` + `npm run build` green
- [ ] Commit + push to `github.com/weels007/vouch`
- [ ] Reply to steward with the fix summary

---

## Request #1 — LLM consensus had no real effect on lending (resolved)

### Steward request

> The lending contract is entirely deterministic with no real write path — add a
> meaningful GenLayer consensus path that affects lending decisions and connect
> the app to the contract lifecycle.

### Root cause

- A free-form LLM payload (`risk_score`, wording) travelled through consensus,
  so validators disagreed → `MAJORITY_DISAGREE` / `UNDETERMINED` and state never
  committed.
- The prompt showed raw wei as GEN ("10000000000000000 GEN") and ignored
  on-chain history, so judgements were noise.
- `fund_loan` was never gated on any verdict; the frontend could not read a
  decision back.

### Fix

- **Consensus payload = only `{"approved": bool}`** — the single value all
  validators must match; `risk_score` is derived deterministically on-chain
  (`_risk_score`) from status/reputation/history.
- **Rubric prompt in GEN units with real on-chain state**: `approved=true` ONLY
  IF status `active` AND reputation ≥ 600 AND request ≤ 100 GEN, evaluated via
  `gl.eq_principle.prompt_comparative` (equivalence principle) over
  `gl.nondet.exec_prompt`.
- **Verdict gates money**: `fund_loan` raises `CREDIT_NOT_ASSESSED` /
  `CREDIT_REJECTED` until an approved verdict is stored; `get_credit_assessment`
  / `get_credit_assessments` expose it to the app.
- Frontend wired to the lifecycle: assessment panel, on-record verdict, loan
  lifecycle actions, dashboard refresh.

### Proof

- Direct tests: consensus switch test (rejected blocks escrow → re-assess
  approves → unlock), prompt spy asserting GEN units + on-chain reputation.
- Live on studionet with the real wallet: `assess_credit` settled **ACCEPTED in
  26s** with `approved: true, risk_score: 0`; both `fund_loan` txs only passed
  after the verdict existed.
- All 14 methods exercised on-chain by `studionet_methods_test.py` — 10 settled
  write txs, 7 views verified.
