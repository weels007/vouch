'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getBorrowerBySender } from '@/lib/genlayer';

/**
 * Live reputation score read from the deployed Vouch contract for the
 * connected wallet. Falls back to an em dash until a wallet is connected.
 */
export default function LiveScore() {
  const { account } = useWallet();
  const [score, setScore] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!account) {
      setScore(null);
      setChecked(true);
      return;
    }
    let cancelled = false;
    setChecked(false);
    getBorrowerBySender(account)
      .then((profile) => {
        if (cancelled) return;
        const value = Number((profile as { reputation?: number })?.reputation ?? 0);
        setScore(value);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  if (!account) {
    return <span className="text-bone">—</span>;
  }
  if (!checked) {
    return <span className="text-bone">…</span>;
  }
  if (score === null) {
    return <span className="text-bone">—</span>;
  }
  return <span className="text-bone">{score}</span>;
}
