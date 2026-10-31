'use client';

import { shortAddress, useWallet } from './WalletProvider';

export default function WalletButton({ compact = false }: { compact?: boolean }) {
  const { account, chainId, openModal } = useWallet();

  if (!account) {
    return (
      <button
        onClick={openModal}
        className={`inline-flex items-center gap-2 font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors ${
          compact ? 'px-4 py-2 text-[13px]' : 'px-5 py-2.5 text-[13px]'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M3 7h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h10M16 13h.01"
          />
        </svg>
        Connect wallet
      </button>
    );
  }

  return (
    <button
      onClick={openModal}
      title={`Connected · ${chainId ? chainId : ''}`}
      className={`inline-flex items-center gap-2.5 border border-line rounded-md font-mono text-[12px] text-bone hover:border-verdigris/60 transition-colors ${
        compact ? 'px-3 py-2' : 'px-4 py-2.5'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-verdigris shrink-0" />
      {shortAddress(account)}
    </button>
  );
}
