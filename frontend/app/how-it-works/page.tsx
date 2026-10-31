import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How It Works — Vouch',
  description:
    'From identity credential to on-chain score to under-collateralized loan — the four-step Vouch protocol, on GenLayer consensus.',
};

const steps = [
  {
    no: '01',
    title: 'Verify identity',
    desc: 'Link your wallet to a verifiable credential through an external provider — OAuth, email, or one-time passcode. Only the cryptographic proof ever touches the ledger.',
  },
  {
    no: '02',
    title: 'Score on-chain',
    desc: 'Validators read the attested history and agree on a reputation score. The result is published on-chain, auditable by anyone, immutable by construction.',
  },
  {
    no: '03',
    title: 'Apply for a loan',
    desc: 'Choose amount and term. Interest adapts to your score, the term, and current market volatility — the quote you see is the quote you get.',
  },
  {
    no: '04',
    title: 'Receive funds',
    desc: 'Once the validator quorum approves the proposal, capital settles directly to your wallet through the lending contract. No escrow, no waiting window.',
  },
];

export default function HowItWorks() {
  return (
    <section className="pt-32 md:pt-40 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-14">
          <div className="flex items-center gap-4 mb-6">
            <span className="eyebrow">Process</span>
            <span className="hidden sm:block flex-1 max-w-28 rule-engraved" />
          </div>
          <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] font-medium text-bone mt-4">
            From credential to capital, in four steps
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-sage">
            The full path a real-world borrower takes from first login to funded loan —
            executed by contracts, not by a company.
          </p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden">
          {steps.map((step, i) => (
            <li key={step.no} className="bg-ink p-7 group hover:bg-ink-2 transition-colors">
              <span className="font-mono text-[11px] text-verdigris">{step.no} / 04</span>
              <h2 className="font-display text-xl text-bone mt-4 mb-2.5">{step.title}</h2>
              <p className="text-sm leading-relaxed text-sage">{step.desc}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="hidden lg:block absolute top-10 left-full w-8 h-px bg-line"
                />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-14 border border-line rounded-lg bg-ink p-7 md:p-9 max-w-3xl">
          <span className="eyebrow">Settlement</span>
          <h2 className="font-display text-2xl md:text-[30px] text-bone mt-4 mb-4">
            What happens between scoring and funding
          </h2>
          <p className="text-[15px] leading-relaxed text-sage">
            When you apply, the lending contract records the proposal and quotes interest
            from live contract state. The validator quorum evaluates risk; if it meets the
            policy threshold the loan is disbursed to your wallet. Repayment schedules and
            collateral ratios are updated in the same immutable transaction.
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-block px-7 py-3.5 text-sm font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors"
            >
              Open the dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
