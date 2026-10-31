'use client';

import { useEffect, useState } from 'react';
import { shortAddress, useWallet } from '@/components/wallet/WalletProvider';
import { getBorrowerBySender } from '@/lib/genlayer';

interface Profile {
  id?: string;
  status?: string;
  reputation?: number;
  total_borrowed?: number;
  total_repaid?: number;
}

const standingLabels: Record<string, string> = {
  active: 'In good standing',
  funded: 'Funding in progress',
  pending: 'Proposal pending',
  repaid: 'Fully repaid',
  defaulted: 'Defaulted',
  liquidated: 'Liquidated',
  unknown: 'Unscored',
};

/**
 * The Certificate of Reputation — a live artifact. Score and standing are read
 * from the deployed UnderCollateralizedLending contract for the connected
 * wallet; nothing here is hardcoded.
 */
export default function Certificate() {
  const { account } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!account) {
      setProfile(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    getBorrowerBySender(account)
      .then((p) => {
        if (cancelled) return;
        setProfile(p as Profile);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  const reputation = Number(profile?.reputation ?? 0);
  const status = profile?.status ?? 'unknown';
  const standing = standingLabels[status] ?? status;

  return (
    <div className="plate guilloche relative p-7 sm:p-8 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-2.5 border border-line/80 rounded-[6px] pointer-events-none"
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-7">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-sage">
            Certificate of Reputation
          </span>
          <span className="font-mono text-[10px] text-verdigris">GEN·BRAD</span>
        </div>

        <div className="flex items-end gap-2">
          <span className="font-display text-[64px] leading-none font-medium text-bone tabular-nums">
            {account && ready ? reputation : '—'}
          </span>
          <span className="font-display text-2xl text-seal pb-1.5">/1000</span>
        </div>
        <p className="mt-2 font-mono text-[11px] text-sage">
          {account && ready ? 'Score certified by validator consensus' : 'Connect a wallet to read your score'}
        </p>

        <dl className="mt-7 space-y-3.5 font-mono text-[12px]">
          <div className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2.5">
            <dt className="text-sage">Borrower</dt>
            <dd className="text-bone text-right">{account ? shortAddress(account) : '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2.5">
            <dt className="text-sage">Reputation</dt>
            <dd className="text-bone text-right">{account && ready ? `${reputation} / 1000` : '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-2.5">
            <dt className="text-sage">Standing</dt>
            <dd className="text-bone text-right">{account && ready ? standing : '—'}</dd>
          </div>
        </dl>

        <div className="mt-7 flex items-center justify-between">
          <span className="relative w-16 h-16 rounded-full border-2 border-seal/70 flex items-center justify-center -rotate-6">
            <span aria-hidden className="absolute inset-1.5 rounded-full border border-seal/40" />
            <span className="font-display text-[11px] tracking-widest uppercase text-seal text-center leading-tight">
              Verified
              <br />
              GL
            </span>
          </span>
          <span className="font-mono text-[10px] text-sage/70 text-right">
            {account ? 'Bound to this wallet address' : 'Connect wallet to certify your score'}
            <br />
            Immutable on-chain
          </span>
        </div>
      </div>
    </div>
  );
}
