'use client';

import { useEffect } from 'react';
import { formatChain, shortAddress, useWallet, type AnnouncedProvider } from './WalletProvider';

const INSTALL_LINKS = [
  { name: 'MetaMask', href: 'https://metamask.io/download/' },
  { name: 'Rabby', href: 'https://rabby.io/' },
];

function ProviderIcon({ provider }: { provider: AnnouncedProvider }) {
  if (provider.info.icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={provider.info.icon}
        alt=""
        width={36}
        height={36}
        className="w-9 h-9 rounded-full bg-ink-3 border border-line object-cover shrink-0"
      />
    );
  }
  return (
    <span className="w-9 h-9 rounded-full bg-ink-3 border border-line flex items-center justify-center font-display text-sm text-bone shrink-0">
      {provider.info.name.charAt(0)}
    </span>
  );
}

export default function WalletModal() {
  const { providers, account, chainId, connecting, error, modalOpen, connect, disconnect, closeModal } = useWallet();

  /* Escape closes; body scroll locked while open */
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [modalOpen, closeModal]);

  if (!modalOpen) return null;

  const missingWallets = INSTALL_LINKS.filter(
    (w) => !providers.some((p) => p.info.name.toLowerCase().includes(w.name.toLowerCase())),
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={closeModal} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={account ? 'Connected wallet' : 'Choose a wallet'}
        className="relative w-full max-w-md bg-ink border border-line rounded-xl overflow-hidden shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <span className="eyebrow">{account ? 'Connected' : 'Connect wallet'}</span>
            <h2 className="font-display text-2xl text-bone mt-2">
              {account ? 'Your account' : 'Choose a wallet'}
            </h2>
          </div>
          <button
            onClick={closeModal}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-md text-sage hover:text-bone hover:border-line border border-transparent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={1.5} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="rule-engraved" />

        {account ? (
          /* ---------- Connected state ---------- */
          <div className="p-6 space-y-5">
            <div className="plate p-4">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage mb-2">Account</div>
              <div className="font-mono text-[15px] text-bone break-all">{shortAddress(account)}</div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-line/70">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage">Network</span>
                <span className="font-mono text-[12px] text-verdigris">{formatChain(chainId)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard?.writeText(account)}
                className="flex-1 py-2.5 text-[13px] font-semibold border border-line text-bone rounded-md hover:border-verdigris/60 hover:text-verdigris-2 transition-colors"
              >
                Copy address
              </button>
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 text-[13px] font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors"
              >
                Done
              </button>
            </div>

            <button
              onClick={() => {
                disconnect();
              }}
              className="w-full py-2.5 text-[13px] font-medium text-stamp border border-stamp/30 rounded-md hover:bg-stamp/10 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          /* ---------- Choosing state ---------- */
          <div className="p-6">
            {providers.length > 0 ? (
              <>
                <p className="text-[13px] leading-relaxed text-sage mb-4">
                  Pick the wallet to connect — only the wallet you choose will ask for
                  approval. No popup wars.
                </p>
                <div className="space-y-2.5">
                  {providers.map((p) => {
                    const busy = connecting === p.info.rdns;
                    return (
                      <button
                        key={p.info.uuid}
                        onClick={() => connect(p.info.rdns)}
                        disabled={connecting !== null}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 border rounded-lg text-left transition-colors ${
                          busy
                            ? 'border-verdigris/60 bg-verdigris/10'
                            : 'border-line hover:border-verdigris/50 hover:bg-ink-2 disabled:opacity-50'
                        }`}
                      >
                        <ProviderIcon provider={p} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-semibold text-bone">{p.info.name}</span>
                          <span className="block font-mono text-[10px] text-sage truncate">{p.info.rdns}</span>
                        </span>
                        {busy ? (
                          <span className="font-mono text-[11px] text-verdigris animate-pulse">waiting…</span>
                        ) : (
                          <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="font-mono text-[12px] text-seal animate-pulse mb-4">
                  Detecting installed wallets…
                </div>
                <p className="text-[13px] text-sage">
                  No EVM wallet found in this browser.
                </p>
              </div>
            )}

            {missingWallets.length > 0 && (
              <div className="mt-5 pt-5 border-t border-line">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-sage mb-3">
                  Don&apos;t have a wallet?
                </div>
                <div className="flex gap-3">
                  {missingWallets.map((w) => (
                    <a
                      key={w.name}
                      href={w.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2.5 text-[13px] font-medium border border-line rounded-md text-sage hover:text-bone hover:border-verdigris/50 transition-colors"
                    >
                      Get {w.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 px-4 py-3 border border-stamp/40 bg-stamp/10 rounded-md">
                <p className="text-[13px] leading-relaxed text-stamp">{error}</p>
              </div>
            )}

            <p className="mt-5 font-mono text-[10px] leading-relaxed text-sage/60">
              Approval happens directly between you and the wallet. Vouch never sees your
              keys or seed phrase.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
