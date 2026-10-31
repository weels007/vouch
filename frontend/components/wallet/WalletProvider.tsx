'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ---------- EIP-6963 / EIP-1193 minimal types ---------- */

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export interface AnnouncedProvider {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

/* ---------- Context ---------- */

interface WalletContextValue {
  providers: AnnouncedProvider[];
  account: string | null;
  chainId: string | null;
  connecting: string | null; // rdns of the provider being connected
  error: string | null;
  modalOpen: boolean;
  connect: (rdns: string) => Promise<void>;
  disconnect: () => void;
  openModal: () => void;
  closeModal: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = 'vouch.wallet.rdns';

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}

/* ---------- Helpers ---------- */

function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function formatChain(chainId: string | null): string {
  if (!chainId) return '';
  const dec = parseInt(chainId, 16);
  if (dec === 1) return 'Ethereum';
  if (dec === 11155111) return 'Sepolia';
  return `Chain ${dec}`;
}

/** Legacy fallback: wallets without EIP-6963 only expose window.ethereum. */
function legacyProvider(): AnnouncedProvider | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as unknown as { ethereum?: EIP1193Provider & { isMetaMask?: boolean; isRabby?: boolean } }).ethereum;
  if (!eth) return null;
  const name = eth.isRabby ? 'Rabby' : eth.isMetaMask ? 'MetaMask' : 'Injected Wallet';
  return {
    info: { uuid: 'legacy', name, icon: '', rdns: eth.isRabby ? 'io.rabby' : eth.isMetaMask ? 'io.metamask' : 'injected' },
    provider: eth,
  };
}

/* ---------- Provider component ---------- */

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<AnnouncedProvider[]>([]);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const providersRef = useRef<AnnouncedProvider[]>([]);
  const listenersRef = useRef<Array<{ provider: EIP1193Provider; event: string; fn: (...a: unknown[]) => void }>>([]);

  const addProvider = useCallback((entry: AnnouncedProvider) => {
    setProviders((prev) => {
      if (prev.some((p) => p.info.uuid === entry.info.uuid)) return prev;
      const next = [...prev, entry];
      providersRef.current = next;
      return next;
    });
  }, []);

  const attachListeners = useCallback((provider: EIP1193Provider) => {
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setChainId(null);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        setAccount(accounts[0]);
      }
    };
    const onChain = (...args: unknown[]) => setChainId(String(args[0]));
    provider.on?.('accountsChanged', onAccounts);
    provider.on?.('chainChanged', onChain);
    listenersRef.current.push(
      { provider, event: 'accountsChanged', fn: onAccounts },
      { provider, event: 'chainChanged', fn: onChain },
    );
  }, []);

  /* EIP-6963 discovery + legacy fallback */
  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<AnnouncedProvider>).detail;
      if (detail && detail.info && detail.provider) addProvider(detail);
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Wallets without EIP-6963 support: expose the single injected provider.
    const timer = window.setTimeout(() => {
      if (providersRef.current.length === 0) {
        const legacy = legacyProvider();
        if (legacy) addProvider(legacy);
      }
    }, 300);

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
      window.clearTimeout(timer);
    };
  }, [addProvider]);

  /* Silent session restore — eth_accounts never triggers a popup */
  useEffect(() => {
    if (providers.length === 0) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || account) return;
    const entry = providers.find((p) => p.info.rdns === saved);
    if (!entry) return;
    let cancelled = false;
    entry.provider
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (cancelled) return;
        const list = accounts as string[];
        if (list && list.length > 0) {
          setAccount(list[0]);
          attachListeners(entry.provider);
          entry.provider
            .request({ method: 'eth_chainId' })
            .then((cid) => !cancelled && setChainId(String(cid)))
            .catch(() => {});
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [providers, account, attachListeners]);

  /* Connect — popup is requested ONLY from the provider the user picked */
  const connect = useCallback(
    async (rdns: string) => {
      const entry = providersRef.current.find((p) => p.info.rdns === rdns);
      if (!entry) {
        setError('Wallet not found. It may have been disabled — enable it and reopen this dialog.');
        return;
      }
      setConnecting(rdns);
      setError(null);
      try {
        const accounts = (await entry.provider.request({ method: 'eth_requestAccounts' })) as string[];
        if (!accounts || accounts.length === 0) throw new Error('No account returned.');
        setAccount(accounts[0]);
        const cid = (await entry.provider.request({ method: 'eth_chainId' })) as string;
        setChainId(cid);
        attachListeners(entry.provider);
        localStorage.setItem(STORAGE_KEY, rdns);
        setModalOpen(false);
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code === 4001) {
          setError('Connection request rejected in the wallet.');
        } else if (code === -32002) {
          setError('A request is already pending in this wallet — open it and approve there.');
        } else {
          setError(err instanceof Error ? err.message : 'Connection failed. Try again.');
        }
      } finally {
        setConnecting(null);
      }
    },
    [attachListeners],
  );

  const disconnect = useCallback(() => {
    for (const { provider, event, fn } of listenersRef.current) provider.removeListener?.(event, fn);
    listenersRef.current = [];
    setAccount(null);
    setChainId(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const openModal = useCallback(() => {
    setError(null);
    setModalOpen(true);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }, []);
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setError(null);
  }, []);

  const value: WalletContextValue = {
    providers,
    account,
    chainId,
    connecting,
    error,
    modalOpen,
    connect,
    disconnect,
    openModal,
    closeModal,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export { shortAddress };
