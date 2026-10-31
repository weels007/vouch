'use client';

import { useCallback, useEffect, useState } from 'react';
import { getTransactionStatus, type TxRecord, type TxStatus } from '@/lib/genlayer';

const STATUS_ORDER: TxStatus[] = ['pending', 'accepted', 'finalized', 'error'];

const statusStyles: Record<
  TxStatus,
  { label: string; text: string; dot: string; chip: string }
> = {
  pending: {
    label: 'Pending',
    text: 'text-seal',
    dot: 'bg-seal',
    chip: 'bg-seal/10 border-seal/40 text-seal',
  },
  accepted: {
    label: 'Accepted',
    text: 'text-verdigris',
    dot: 'bg-verdigris',
    chip: 'bg-verdigris/10 border-verdigris/40 text-verdigris',
  },
  finalized: {
    label: 'Finalized',
    text: 'text-bone',
    dot: 'bg-bone',
    chip: 'bg-bone/10 border-bone/40 text-bone',
  },
  error: {
    label: 'Error',
    text: 'text-stamp',
    dot: 'bg-stamp',
    chip: 'bg-stamp/10 border-stamp/40 text-stamp',
  },
};

const statusHint: Record<TxStatus, string> = {
  pending: 'awaiting quorum',
  accepted: 'quorum reached',
  finalized: 'irreversible',
  error: 'rejected',
};

function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export default function TxExplorer() {
  const [input, setInput] = useState('');
  const [record, setRecord] = useState<TxRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (hash: string) => {
    const clean = hash.trim().toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(clean)) {
      setError('Enter a full transaction hash — 0x followed by 64 hex characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await getTransactionStatus(clean);
      setRecord(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction lookup failed.');
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!record || record.status !== 'pending') return;
    const timer = setInterval(() => {
      void lookup(record.hash);
    }, 5000);
    return () => clearInterval(timer);
  }, [record, lookup]);

  const status: TxStatus = record?.status ?? 'finalized';
  const s = statusStyles[status];

  return (
    <section id="explorer" className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-px bg-line border border-line rounded-lg overflow-hidden">
          {/* Transaction record */}
          <div className="bg-ink p-7 sm:p-9">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-8">
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 h-10 rounded-md bg-ink-2 border border-line px-4 font-mono text-[13px] text-bone flex items-center">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                    className="w-full bg-transparent outline-none text-inherit font-inherit"
                  />
                </div>
                <button
                  onClick={() => void lookup(input)}
                  disabled={loading}
                  className="h-10 px-5 text-[13px] font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Checking…' : 'Look up'}
                </button>
              </div>
              <div className={`inline-flex items-center gap-2 h-10 px-4 rounded-md border font-mono text-[12px] ${s.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </div>
            </div>

            <h2 className="font-display text-2xl text-bone mb-6">Transaction record</h2>

            {error ? (
              <p className="font-mono text-[12px] text-stamp">{error}</p>
            ) : !record ? (
              <p className="font-mono text-[12px] text-sage">
                {loading ? 'Querying the GenLayer ledger…' : 'Paste a transaction hash to read its live status.'}
              </p>
            ) : (
              <>
                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 font-mono text-[12.5px]">
                  <div className="border-b border-line/60 pb-3">
                    <dt className="text-sage text-[10px] tracking-[0.2em] uppercase mb-1.5">Tx hash</dt>
                    <dd className="text-bone break-all">{shortHash(record.hash)}</dd>
                  </div>
                  <div className="border-b border-line/60 pb-3">
                    <dt className="text-sage text-[10px] tracking-[0.2em] uppercase mb-1.5">Status</dt>
                    <dd className={`text-[13px] font-semibold ${s.text}`}>{s.label}</dd>
                  </div>
                  <div className="border-b border-line/60 pb-3">
                    <dt className="text-sage text-[10px] tracking-[0.2em] uppercase mb-1.5">Sender</dt>
                    <dd className="text-bone break-all">{record.sender ? `${record.sender.slice(0, 10)}…${record.sender.slice(-8)}` : '—'}</dd>
                  </div>
                  <div className="border-b border-line/60 pb-3">
                    <dt className="text-sage text-[10px] tracking-[0.2em] uppercase mb-1.5">Block</dt>
                    <dd className="text-bone">{record.blockNumber ? Number(record.blockNumber).toLocaleString() : '—'}</dd>
                  </div>
                  <div className="border-b border-line/60 pb-3">
                    <dt className="text-sage text-[10px] tracking-[0.2em] uppercase mb-1.5">Gas used</dt>
                    <dd className="text-bone">{record.gasUsed ? Number(record.gasUsed).toLocaleString() : '—'}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>

          {/* Lifecycle switcher */}
          <div className="bg-ink p-7 sm:p-9 flex flex-col">
            <span className="eyebrow">Lifecycle</span>
            <h2 className="font-display text-xl text-bone mt-3 mb-6">Transaction status</h2>

            <div className="space-y-2.5">
              {STATUS_ORDER.map((key) => {
                const st = statusStyles[key];
                const done = STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(key);
                return (
                  <div
                    key={key}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md border text-[13px] font-medium transition-colors ${
                      done
                        ? st.chip
                        : 'border-line text-sage'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${done ? st.dot : 'bg-line'}`} />
                    {st.label}
                    <span className="ml-auto font-mono text-[10px] text-sage/60 uppercase tracking-widest">
                      {statusHint[key]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-8">
              <div className="rule-engraved mb-5" />
              <dl className="space-y-3 font-mono text-[11px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-sage">Contract</dt>
                  <dd className="text-bone text-right">UnderCollaterizedLending.py</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sage">Runner</dt>
                  <dd className="text-sage text-right break-all">py-genlayer:1jb45aa8…</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
