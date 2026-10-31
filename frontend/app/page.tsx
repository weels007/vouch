import Link from 'next/link';
import Certificate from '@/components/Certificate';

export default function Home() {
  return (
    <>
      {/* HERO — identity document meets on-chain score */}
      <section className="relative pt-32 md:pt-40 pb-20 lg:pb-28 overflow-hidden">
        <div
          aria-hidden
          className="guilloche guilloche-fade absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-[1.15fr_1fr] gap-14 lg:gap-20 items-center">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <span className="eyebrow">Vouch Protocol</span>
              <span className="hidden sm:block flex-1 max-w-32 rule-engraved" />
              <span className="font-mono text-[10px] tracking-widest uppercase text-sage">
                GenLayer Testnet
              </span>
            </div>

            <h1 className="font-display text-[44px] leading-[1.04] sm:text-6xl lg:text-[68px] font-medium tracking-[-0.015em] text-bone">
              Connect identity
              <br />
              to{' '}
              <span className="italic gradient-text">reputation.</span>
            </h1>

            <p className="mt-7 text-[17px] leading-relaxed text-sage max-w-xl">
              Banks lend on your history. DeFi lends on your lockup. We lend on both —
              validator consensus turns real-world credentials into an on-chain credit
              score, so collateral requirements drop to what risk actually demands.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="px-7 py-3.5 text-sm font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors text-center"
              >
                Open the dashboard
              </Link>
              <Link
                href="#how-it-works"
                className="px-7 py-3.5 text-sm font-semibold border border-line text-bone rounded-md hover:border-verdigris/60 hover:text-verdigris-2 transition-colors text-center"
              >
                How it works
              </Link>
            </div>

            <p className="mt-8 font-mono text-[11px] text-sage/60 break-all">
              contract: UnderCollaterizedLending.py
            </p>
          </div>

          {/* Certificate of Reputation — the artifact this protocol issues */}
          <Certificate />
        </div>
      </section>

      {/* HOW IT WORKS — a real sequence, numbered as one */}
      <section id="how-it-works" className="py-20 md:py-28 border-t border-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <span className="eyebrow">Process</span>
            <h2 className="font-display text-3xl md:text-[42px] leading-tight font-medium text-bone mt-4">
              From credential to capital, in four steps
            </h2>
          </div>

          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden">
            {[
              {
                title: 'Verify identity',
                desc: 'Link your wallet to an off-chain credential through an external provider — OAuth, email, or one-time passcode.',
              },
              {
                title: 'Score on-chain',
                desc: 'Validators read the attested history and agree on a reputation score. The result is public, auditable, and immutable.',
              },
              {
                title: 'Apply for a loan',
                desc: 'Choose amount and term. Interest adapts to your score, the term, and current market volatility.',
              },
              {
                title: 'Receive funds',
                desc: 'Once the quorum approves the proposal, capital settles straight to your wallet. No escrow, no waiting window.',
              },
            ].map((step, i) => (
              <li key={step.title} className="bg-ink p-7 group hover:bg-ink-2 transition-colors">
                <span className="font-mono text-[11px] text-verdigris">
                  {String(i + 1).padStart(2, '0')} / 04
                </span>
                <h3 className="font-display text-xl text-bone mt-4 mb-2.5">{step.title}</h3>
                <p className="text-sm leading-relaxed text-sage">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-20 md:py-28 border-t border-line">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-start">
            <span className="eyebrow md:sticky md:top-28">About</span>
            <div>
              <h2 className="font-display text-3xl md:text-[38px] leading-tight font-medium text-bone mb-6">
                Collateral that reflects reality, not paranoia
              </h2>
              <p className="text-[15px] leading-relaxed text-sage mb-4">
                Most protocols demand 150%+ lockup because they cannot know who you are.
                This one can. Our contracts run on GenLayer&apos;s consensus engine:
                validators evaluate attested identity data and price risk honestly, so
                collateral stays proportional to exposure instead of covering for the
                absence of trust.
              </p>
              <ul className="mt-6 space-y-3.5">
                {[
                  'Identity → cryptographic proof → validator scoring → loan decision',
                  'Collateral ratios adjust with market volatility and borrower standing',
                  'Rates are published in the contract — every party sees the same risk price',
                ].map((item) => (
                  <li key={item} className="flex gap-3.5 text-[15px] leading-relaxed text-bone/85">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-verdigris shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 border-t border-line">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow">Questions</span>
            <h2 className="font-display text-3xl md:text-[42px] leading-tight font-medium text-bone mt-4">
              Before you borrow
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Do I need a bank account?',
                a: 'No. You need a GenLayer wallet and one verifiable credential — an email, an OAuth identity, or a one-time passcode is enough to start building a score.',
              },
              {
                q: 'How long does verification take?',
                a: 'Usually one to three minutes, depending on how many validators are online when your attestation is proposed.',
              },
              {
                q: 'How is the interest rate calculated?',
                a: 'From three inputs: your reputation score, the loan term, and current market volatility. All three are read from contract state, so the quote you see is the rate you get.',
              },
              {
                q: 'What happens if I miss a payment?',
                a: 'The loan is flagged and your score is revised downward, which lowers your next borrowing capacity. Reputation is the collateral — defaults follow you.',
              },
            ].map((item) => (
              <details key={item.q} className="plate px-6 py-4 group">
                <summary className="flex items-center justify-between gap-4 cursor-pointer text-[15px] font-medium text-bone hover:text-verdigris-2 transition-colors">
                  {item.q}
                  <svg
                    className="w-4 h-4 shrink-0 text-verdigris transition-transform group-open:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeWidth={1.5} d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="mt-3.5 pr-8 text-sm leading-relaxed text-sage">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24 border-t border-line">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-[40px] leading-tight font-medium text-bone">
            Ready to borrow on reputation?
          </h2>
          <p className="mt-4 text-[15px] text-sage max-w-xl mx-auto">
            Create your borrower profile, let the validators score you, and see your
            collateral ratio drop.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-7 py-3.5 text-sm font-semibold bg-verdigris text-ink rounded-md hover:bg-verdigris-2 transition-colors"
            >
              Open the dashboard
            </Link>
            <Link
              href="/explorer"
              className="px-7 py-3.5 text-sm font-semibold border border-line text-bone rounded-md hover:border-verdigris/60 hover:text-verdigris-2 transition-colors"
            >
              Inspect a transaction
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
