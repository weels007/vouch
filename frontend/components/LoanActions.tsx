'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getCreditAssessmentFor,
  getLoans,
  getTransactionStatus,
  writeAssessCredit,
  writeCreateLoan,
  writeDisburseLoan,
  writeFundLoan,
  type CreditDecision,
  type TxRecord,
} from '@/lib/genlayer';
import { useWallet } from '@/components/wallet/WalletProvider';

interface CreditState {
  phase: 'idle' | 'running' | 'submitted' | 'finalized' | 'error';
  hash?: string;
  error?: string;
}

const IDLE_CREDIT: CreditState = { phase: 'idle' };

function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export default function LoanActions() {
  const { account, provider, openModal } = useWallet();
  const [amount, setAmount] = useState('100');
  const [interestRate, setInterestRate] = useState('500');
  const [credit, setCredit] = useState<CreditState>(IDLE_CREDIT);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decision, setDecision] = useState<CreditDecision | null>(null);

  /* Read the verdict the quorum already committed to storage. */
  const refreshDecision = useCallback(async () => {
    if (!account) {
      setDecision(null);
      return;
    }
    try {
      setDecision(await getCreditAssessmentFor(account));
    } catch {
      /* keep the last known verdict on transient RPC errors */
    }
  }, [account]);

  useEffect(() => {
    void refreshDecision();
  }, [refreshDecision]);

  /* Poll the live GenLayer transaction status until it settles. */
  const waitForFinal = useCallback((hash: string, onFinalized: () => void, onError: (msg: string) => void) => {
    const timer = setInterval(async () => {
      const record: TxRecord = await getTransactionStatus(hash);
      if (record.status === 'finalized') {
        clearInterval(timer);
        onFinalized();
      } else if (record.status === 'error') {
        clearInterval(timer);
        onError('Transaction failed on-chain.');
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const runCredit = useCallback(async () => {
    if (!account || !provider) return;
    let value: bigint;
    try {
      value = BigInt(amount);
    } catch {
      setCredit({ phase: 'error', error: 'Enter a valid assessment amount greater than zero.' });
      return;
    }
    if (value <= BigInt(0)) {
      setCredit({ phase: 'error', error: 'Enter a valid assessment amount greater than zero.' });
      return;
    }
    setBusy(true);
    setActionError(null);
    const outcome = await writeAssessCredit(provider, account, account, value);
    setBusy(false);
    if (!outcome.ok) {
      setCredit({ phase: 'error', error: outcome.error ?? 'Consensus assessment failed.' });
      return;
    }
    setCredit({ phase: 'submitted', hash: outcome.hash });
  }, [account, provider, amount]);

  useEffect(() => {
    if (credit.phase !== 'submitted' || !credit.hash) return;
    let cancelled = false;
    const hash = credit.hash;
    const stop = waitForFinal(hash, () => {
      if (cancelled) return;
      setCredit((prev) => (prev.phase === 'submitted' ? { phase: 'finalized', hash: prev.hash } : prev));
      // the verdict is committed with the transaction — read it back
      void refreshDecision();
    }, (msg) => {
      if (cancelled) return;
      setCredit({ phase: 'error', error: msg });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [credit.phase, credit.hash, waitForFinal, refreshDecision]);

  const runCreateLoan = useCallback(async () => {
    if (!account || !provider) return;
    let loanAmount: bigint;
    let rate: bigint;
    try {
      loanAmount = BigInt(amount);
      rate = BigInt(interestRate);
    } catch {
      setActionError('Enter a valid loan amount and interest rate.');
      return;
    }
    setBusy(true);
    setActionError(null);
    const outcome = await writeCreateLoan(provider, account, account, loanAmount, rate);
    setBusy(false);
    if (!outcome.ok) {
      setActionError(outcome.error ?? 'Create loan transaction failed.');
      return;
    }
    const hash = outcome.hash;
    const stop = waitForFinal(hash, async () => {
      setBusy(false);
      const loans = await getLoans();
      const mine = (loans ?? {}) as Record<string, { id?: string; borrower?: string; status?: string }>;
      const pendingIds = Object.keys(mine).filter((k) => {
        const l = mine[k];
        return l?.status === 'pending' && String(l?.borrower ?? '').toLowerCase() === String(account).toLowerCase();
      });
      if (pendingIds.length > 0) setLoanId(pendingIds[pendingIds.length - 1]);
    }, () => {
      setActionError('Create loan transaction failed on-chain.');
      setBusy(false);
    });
    void stop;
  }, [account, provider, amount, interestRate, waitForFinal]);

  const runFundLoan = useCallback(async () => {
    if (!account || !provider || !loanId) return;
    let value: bigint;
    try {
      value = BigInt(amount);
    } catch {
      setActionError('Enter a valid funding amount greater than zero.');
      return;
    }
    if (value <= BigInt(0)) {
      setActionError('Enter a valid funding amount greater than zero.');
      return;
    }
    setBusy(true);
    setActionError(null);
    const outcome = await writeFundLoan(provider, account, loanId, value);
    setBusy(false);
    if (!outcome.ok) {
      setActionError(outcome.error ?? 'Funding transaction failed.');
      return;
    }
    const hash = outcome.hash;
    const stop = waitForFinal(hash, () => setBusy(false), () => {
      setActionError('Funding transaction failed on-chain.');
      setBusy(false);
    });
    void stop;
  }, [account, provider, loanId, amount, waitForFinal]);

  const runDisburseLoan = useCallback(async () => {
    if (!account || !provider || !loanId) return;
    let value: bigint;
    try {
      value = BigInt(amount);
    } catch {
      setActionError('Enter a valid disbursement amount greater than zero.');
      return;
    }
    if (value <= BigInt(0)) {
      setActionError('Enter a valid disbursement amount greater than zero.');
      return;
    }
    setBusy(true);
    setActionError(null);
    const outcome = await writeDisburseLoan(provider, account, loanId, value);
    setBusy(false);
    if (!outcome.ok) {
      setActionError(outcome.error ?? 'Disbursement transaction failed.');
      return;
    }
    const hash = outcome.hash;
    const stop = waitForFinal(hash, () => setBusy(false), () => {
      setActionError('Disbursement transaction failed on-chain.');
      setBusy(false);
    });
    void stop;
  }, [account, provider, loanId, amount, waitForFinal]);

  const assessmentFinal = credit.phase === 'finalized';

  if (!account || !provider) {
    return (
      <div className="border border-line rounded-lg p-6 mb-10">
        <span className="eyebrow">Protocol actions</span>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <p className="text-[15px] text-sage max-w-xl leading-relaxed">
            Connect a wallet to run live consensus-settled protocol actions — credit assessment,
            loan funding, and disbursement — against the deployed contract.
          </p>
          <button
            onClick={openModal}
            className="shrink-0 px-6 py-3 text-[13px] font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors"
          >
            Connect wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-10">
      <div className="flex items-center gap-4 mb-6">
        <span className="eyebrow">Protocol actions</span>
        <span className="hidden sm:block flex-1 max-w-32 rule-engraved" />
        <span className="font-mono text-[10px] tracking-widest uppercase text-sage">
          Live · signed · consensus-settled
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-px bg-line border border-line rounded-lg overflow-hidden">
        {/* Credit assessment */}
        <div className="bg-ink p-7 sm:p-9">
          <h2 className="font-display text-xl text-bone mb-2">Validator credit assessment</h2>
          <p className="text-sm text-sage leading-relaxed mb-6">
            The risk validator runs a comparative-consensus LLM judgement over the borrower
            history. The agreed verdict can gate funding.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-11 border border-line rounded-md bg-ink-2 px-4 flex items-center">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Amount (GEN)"
                inputMode="numeric"
                className="w-full bg-transparent outline-none text-inherit font-inherit"
              />
            </div>
            <button
              onClick={() => void runCredit()}
              disabled={busy || credit.phase === 'running'}
              className="shrink-0 px-6 h-11 text-[13px] font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors disabled:opacity-50"
            >
              {busy || credit.phase === 'running' ? 'Assessing…' : 'Run consensus assessment'}
            </button>
          </div>

          <div className="mt-5 font-mono text-[12px] min-h-[20px]">
            {credit.phase === 'idle' && <span className="text-sage/60">No assessment yet — the validator quorum has not voted.</span>}
            {credit.phase === 'running' && <span className="text-seal">Awaiting wallet signature…</span>}
            {credit.phase === 'submitted' && <span className="text-verdigris">Consensus assessment in flight — awaiting quorum…</span>}
            {credit.phase === 'finalized' && <span className="text-bone">Consensus assessment delivered and final.</span>}
            {credit.phase === 'error' && <span className="text-stamp">{credit.error ?? 'Assessment failed.'}</span>}
          </div>

          {credit.hash && (
            <p className="mt-3 font-mono text-[11px] text-sage break-all">
              tx {shortHash(credit.hash)}
            </p>
          )}

          {/* Verdict the quorum committed to contract storage */}
          <div className="mt-4 border-t border-line/60 pt-4 font-mono text-[12px] space-y-2.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sage">On-record verdict</span>
              {decision ? (
                <span className={decision.approved ? 'text-verdigris' : 'text-stamp'}>
                  {decision.approved ? 'Approved' : 'Rejected'}
                </span>
              ) : (
                <span className="text-sage/60">none stored</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sage">Risk score</span>
              <span className="text-bone">
                {decision?.risk_score !== undefined ? `${decision.risk_score}/100` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sage">Assessed amount</span>
              <span className="text-bone">
                {decision?.amount !== undefined ? `${Number(decision.amount).toLocaleString()} GEN` : '—'}
              </span>
            </div>
          </div>

          {actionError && <p className="mt-3 font-mono text-[11px] text-stamp">{actionError}</p>}
        </div>

        {/* Lifecycle: create → fund → disburse */}
        <div className="bg-ink p-7 sm:p-9">
          <h2 className="font-display text-xl text-bone mb-2">Loan lifecycle</h2>
          <p className="text-sm text-sage leading-relaxed mb-6">
            Open a proposal, lock GEN into escrow, and release the disbursement — each step settled
            by validator consensus.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="h-11 border border-line rounded-md bg-ink-2 px-4 flex items-center">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Amount (GEN)"
                inputMode="numeric"
                className="w-full bg-transparent outline-none text-inherit font-inherit"
              />
            </div>
            <div className="h-11 border border-line rounded-md bg-ink-2 px-4 flex items-center">
              <input
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Rate (bps)"
                inputMode="numeric"
                className="w-full bg-transparent outline-none text-inherit font-inherit"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void runCreateLoan()}
              disabled={busy}
              className="px-5 h-11 text-[13px] font-semibold border border-line text-bone rounded-md hover:border-verdigris/60 hover:text-verdigris-2 transition-colors disabled:opacity-50"
            >
              Create loan
            </button>
            <button
              onClick={() => void runFundLoan()}
              disabled={!loanId || busy}
              className="px-5 h-11 text-[13px] font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors disabled:opacity-50"
            >
              Fund escrow
            </button>
            <button
              onClick={() => void runDisburseLoan()}
              disabled={!loanId || busy}
              className="px-5 h-11 text-[13px] font-semibold border border-line text-bone rounded-md hover:border-verdigris/60 hover:text-verdigris-2 transition-colors disabled:opacity-50"
            >
              Disburse
            </button>
          </div>

          <div className="mt-5 font-mono text-[12px]">
            <div className="flex items-center justify-between gap-4 border-b border-line/60 pb-2.5">
              <dt className="text-sage">Current loan id</dt>
              <dd className="text-bone text-right break-all">{loanId ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 pt-3">
              <dt className="text-sage">Consensus gate</dt>
              <dd
                className={`text-right ${
                  decision ? (decision.approved ? 'text-verdigris' : 'text-stamp') : 'text-bone'
                }`}
              >
                {decision
                  ? decision.approved
                    ? 'Approved — funding unlocked'
                    : 'Rejected — funding blocked'
                  : assessmentFinal
                    ? 'Assessment final'
                    : 'Awaiting assessment'}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
