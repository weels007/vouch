import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Features — Vouch',
  description:
    'On-chain reputation, adaptive interest, private identity, and reduced collateral — what the Vouch protocol guarantees every borrower.',
};

const features = [
  {
    tag: 'Credit',
    title: 'On-Chain Reputation',
    desc: 'Your score is computed by validator consensus from attested financial history — auditable by anyone, alterable by no one.',
    stat: 'Score range 0–1000 · 12/13 quorum typical',
  },
  {
    tag: 'Rates',
    title: 'Adaptive Interest',
    desc: 'Pricing reads three live inputs — score, term, volatility — straight from contract state. Better risk pays less, on a curve nobody can edit.',
    stat: 'From 3.2% APR at score 900+',
  },
  {
    tag: 'Transparency',
    title: 'Real-Time Explorer',
    desc: 'Every proposal, quorum, and settlement is queryable as it happens and archived permanently once finalized.',
    stat: '4 status states: pending · accepted · finalized · error',
  },
  {
    tag: 'Privacy',
    title: 'Zero-Knowledge Identity',
    desc: 'Credentials stay off-chain and encrypted. Only the proof that verification happened touches the ledger — never the documents themselves.',
    stat: '0 raw credentials stored on-chain',
  },
  {
    tag: 'Capital',
    title: 'Reduced Collateral',
    desc: 'Post what the risk model asks for, not what a protocol afraid of you demands. Ratios revalue with market conditions as the loan lives.',
    stat: 'From 15% vs 150%+ DeFi standard',
  },
  {
    tag: 'Access',
    title: 'Inclusive Finance',
    desc: 'No bank onboarding, no credit-bureau gate, no jurisdiction checklist. A wallet and one verifiable credential are the entire entry barrier.',
    stat: '1 credential to start',
  },
];

export default function Features() {
  return (
    <>
      <section className="pt-32 md:pt-40 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="flex items-center gap-4 mb-6">
              <span className="eyebrow">Capabilities</span>
              <span className="hidden sm:block flex-1 max-w-28 rule-engraved" />
            </div>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] font-medium text-bone">
              Built like a <span className="italic gradient-text">bonded instrument</span>
            </h1>
            <p className="mt-6 text-[16px] leading-relaxed text-sage">
              Six guarantees the protocol makes to every borrower — enforced by contract
              logic, not by a company&apos;s policy page.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden">
            {features.map((f) => (
              <article key={f.title} className="bg-ink p-7 flex flex-col group hover:bg-ink-2 transition-colors">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-verdigris">
                  {f.tag}
                </span>
                <h2 className="font-display text-[22px] leading-snug text-bone mt-4 mb-3">
                  {f.title}
                </h2>
                <p className="text-sm leading-relaxed text-sage flex-1">{f.desc}</p>
                <div className="rule-engraved mt-6 mb-3" />
                <p className="font-mono text-[11px] text-seal/90">{f.stat}</p>
              </article>
            ))}
          </div>

          {/* Contrast: what the protocol removes */}
          <div className="mt-16 grid md:grid-cols-2 gap-px bg-line border border-line rounded-lg overflow-hidden">
            <div className="bg-ink p-8">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-stamp">
                Over-collateralized
              </span>
              <p className="font-display text-5xl text-bone mt-4">150%+</p>
              <p className="text-sm text-sage mt-3 leading-relaxed">
                You lock twice what you borrow, and the protocol still knows nothing
                about you. One liquidation wipes positions that were never at risk.
              </p>
            </div>
            <div className="bg-ink p-8">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-verdigris">
                Under-collateralized
              </span>
              <p className="font-display text-5xl text-bone mt-4">15%</p>
              <p className="text-sm text-sage mt-3 leading-relaxed">
                Consensus knows who is borrowing and prices the risk accordingly.
                Collateral tracks exposure — no more, no less.
              </p>
            </div>
          </div>

          <div className="mt-14 flex flex-col sm:flex-row gap-4">
            <Link
              href="/dashboard"
              className="px-7 py-3.5 text-sm font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors text-center"
            >
              Open the dashboard
            </Link>
            <Link
              href="/explorer"
              className="px-7 py-3.5 text-sm font-semibold border border-line text-bone rounded-md hover:border-verdigris/60 hover:text-verdigris-2 transition-colors text-center"
            >
              View the explorer
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
