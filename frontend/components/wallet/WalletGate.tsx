'use client';

import { formatChain, shortAddress, useWallet } from './WalletProvider';

export default function WalletGate() {
  const { account, chainId, openModal } = useWallet();

  if (!account) {
    return (
      <div className="border border-line rounded-lg p-6 mb-10 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
        <div>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-seal">
            No wallet connected
          </span>
          <p className="text-[15px] text-sage mt-2 max-w-xl leading-relaxed">
            Connect an EVM wallet — MetaMask or Rabby — to read your live borrower
            profile and loan state from the contract.
          </p>
        </div>
        <button
          onClick={openModal}
          className="shrink-0 px-6 py-3 text-[13px] font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="border border-verdigris/30 bg-verdigris/[0.04] rounded-lg p-6 mb-10 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
      <div className="flex items-center gap-4">
        <span className="w-2 h-2 rounded-full bg-verdigris shrink-0" />
        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-verdigris">
            Connected
          </div>
          <div className="font-mono text-[14px] text-bone mt-1 break-all">{shortAddress(account)}</div>
        </div>
      </div>
      <div className="text-left sm:text-right">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage">Network</div>
        <div className="font-mono text-[13px] text-bone mt-1">{formatChain(chainId)}</div>
      </div>
    </div>
  );
}
