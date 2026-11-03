'use client';

import { useEffect, useState } from 'react';
import { getBorrowerBySender, getLoans, getLoanCount } from '@/lib/genlayer';
import { useWallet } from '@/components/wallet/WalletProvider';
import WalletGate from '@/components/wallet/WalletGate';
import LoanActions from '@/components/LoanActions';

interface Profile {
  id?: string;
  status?: string;
  reputation?: number;
  total_borrowed?: number;
  total_repaid?: number;
}

interface LoanRecord {
  id?: string;
  borrower?: string;
  amount?: number;
  interest_rate?: number;
  status?: string;
  created_at?: string;
  due_date?: string;
  deposited?: number;
}

export default function Dashboard() {
  const { account } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<Record<string, LoanRecord>>({});
  const [loanCount, setLoanCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setProfile(null);
      setLoans({});
      setLoanCount(0);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBorrowerBySender(account)
      .then((p) => {
        if (cancelled) return;
        setProfile(p as Profile);
        return getLoans();
      })
      .then((l) => {
        if (cancelled) return;
        if (l) {
          const all = l as Record<string, LoanRecord>;
          const mine: Record<string, LoanRecord> = {};
          for (const [loanId, loan] of Object.entries(all ?? {})) {
            const borrowerAddr = String(loan?.borrower ?? '').toLowerCase();
            if (account && borrowerAddr && borrowerAddr !== account.toLowerCase()) continue;
            mine[loanId] = loan;
          }
          setLoans(mine);
        }
      })
      .then(() => {
        if (cancelled) return;
        return getLoanCount();
      })
      .then((c) => {
        if (cancelled) return;
        setLoanCount(Number(c ?? 0));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to read contract state.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  const statusChip: Record<string, string> = {
    active: 'bg-seal/10 text-seal border border-seal/30',
    repaid: 'bg-verdigris/10 text-verdigris border border-verdigris/30',
    defaulted: 'bg-stamp/10 text-stamp border border-stamp/30',
    liquidated: 'bg-stamp/10 text-stamp border border-stamp/30',
    funded: 'bg-verdigris/10 text-verdigris border border-verdigris/30',
    pending: 'bg-bone/10 text-bone border border-bone/30',
  };

  const statusLabel: Record<string, string> = {
    active: 'Active',
    repaid: 'Repaid',
    defaulted: 'Defaulted',
    liquidated: 'Liquidated',
    funded: 'Funded',
    pending: 'Pending',
  };

  const reputation = Number(profile?.reputation ?? 0);
  const totalBorrowed = Number(profile?.total_borrowed ?? 0);
  const totalRepaid = Number(profile?.total_repaid ?? 0);

  return (
    <section className="pt-32 md:pt-40 pb-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10">
          <div>
            <div className="flex items-center gap-4 mb-5">
              <span className="eyebrow">Borrower Console</span>
              <span className="hidden sm:block flex-1 max-w-24 rule-engraved" />
            </div>
            <h1 className="font-display text-[36px] md:text-[48px] leading-tight font-medium text-bone">
              Dashboard
            </h1>
            <p className="text-sage mt-2 text-[15px]">Your loans, your score, your collateral.</p>
          </div>
          <WalletGate />
        </div>

        {/* Reputation ledger — live from the contract */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden mb-10">
          <div className="bg-ink p-6">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage">Reputation score</div>
            <div className="font-display text-[34px] leading-none mt-3 text-verdigris">
              {reputation}
              <span className="text-lg text-sage">/1000</span>
            </div>
          </div>
          <div className="bg-ink p-6">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage">Total borrowed</div>
            <div className="font-display text-[34px] leading-none mt-3 text-bone">
              {totalBorrowed.toLocaleString()}
              <span className="text-lg text-sage"> GEN</span>
            </div>
          </div>
          <div className="bg-ink p-6">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage">Total repaid</div>
            <div className="font-display text-[34px] leading-none mt-3 text-bone">
              {totalRepaid.toLocaleString()}
              <span className="text-lg text-sage"> GEN</span>
            </div>
          </div>
          <div className="bg-ink p-6">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage">Open loans</div>
            <div className="font-display text-[34px] leading-none mt-3 text-bone">{loanCount}</div>
          </div>
        </div>

        {/* Live, consensus-settled protocol actions */}
        <LoanActions />

        {/* Loans — live from the contract */}
        <div className="border border-line rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-7 py-5 border-b border-line bg-ink-2">
            <h2 className="font-display text-xl text-bone">Loans</h2>
            <span className="font-mono text-[11px] text-sage">{Object.keys(loans).length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Loan ID', 'Amount', 'Rate', 'Status', 'Due date', ''].map((h) => (
                    <th
                      key={h}
                      className="px-7 py-3.5 font-mono text-[10px] tracking-[0.2em] uppercase text-sage font-normal"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(loans).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-7 py-8 text-center font-mono text-[12px] text-sage">
                      {loading ? 'Reading loan ledger…' : 'No loans recorded for this borrower yet.'}
                    </td>
                  </tr>
                ) : (
                  Object.entries(loans).map(([loanId, loan]) => (
                    <tr
                      key={loanId}
                      className="border-b border-line/60 last:border-b-0 hover:bg-ink-2 transition-colors"
                    >
                      <td className="px-7 py-4 font-mono text-[13px] text-bone">{loanId}</td>
                      <td className="px-7 py-4 text-bone font-medium">{Number(loan.amount ?? 0).toLocaleString()} GEN</td>
                      <td className="px-7 py-4 font-mono text-sage">{loan.interest_rate !== undefined ? `${Number(loan.interest_rate) / 100}%` : '—'}</td>
                      <td className="px-7 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold ${statusChip[loan.status ?? ''] ?? 'bg-ink-3 text-sage border border-line'}`}>
                          {statusLabel[loan.status ?? ''] ?? String(loan.status ?? 'Unknown')}
                        </span>
                      </td>
                      <td className="px-7 py-4 font-mono text-[13px] text-sage">{loan.due_date ?? '—'}</td>
                      <td className="px-7 py-4" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error ? (
          <p className="mt-5 font-mono text-[11px] text-stamp">{error}</p>
        ) : (
          <p className="mt-5 font-mono text-[11px] text-sage/60">
            Live state — reads from UnderCollaterizedLending on GenLayer.
          </p>
        )}
      </div>
    </section>
  );
}
