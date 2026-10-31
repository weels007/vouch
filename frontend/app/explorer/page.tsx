import type { Metadata } from 'next';
import TxExplorer from '@/components/TxExplorer';

export const metadata: Metadata = {
  title: 'Explorer — Vouch',
  description:
    'Track contract interactions on the GenLayer network: pending, accepted, finalized, or failed — every state in the transaction lifecycle.',
};

export default function Explorer() {
  return (
    <>
      <section className="pt-32 md:pt-40 pb-4">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-6">
              <span className="eyebrow">Testnet Explorer</span>
              <span className="hidden sm:block flex-1 max-w-28 rule-engraved" />
            </div>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] font-medium text-bone">
              Every proposal, <span className="italic gradient-text">on the record</span>
            </h1>
            <p className="mt-6 text-[16px] leading-relaxed text-sage">
              Look up any transaction against the lending contract and follow its full
              lifecycle — from proposal to finality.
            </p>
          </div>
        </div>
      </section>

      <TxExplorer />
    </>
  );
}
