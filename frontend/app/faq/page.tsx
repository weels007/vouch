import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ — Vouch',
  description:
    'Questions borrowers ask before taking a Vouch loan: identity, scoring, interest, and what happens when repayments slip.',
};

const faqs = [
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
  {
    q: 'What is the minimum collateral ratio?',
    a: 'The protocol starts at 15% collateral against the drawn amount — a fraction of the 150%+ typical of over-collateralized DeFi lending. Ratios revalue as the loan lives and market conditions change.',
  },
  {
    q: 'Is my identity data stored on-chain?',
    a: 'No. Credentials stay off-chain and encrypted. Only the proof that verification happened — and the derived reputation score — ever touch the ledger.',
  },
];

export default function FAQ() {
  return (
    <section className="pt-32 md:pt-40 pb-20 md:pb-28">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="eyebrow">Questions</span>
            <span className="hidden sm:block flex-1 max-w-28 rule-engraved" />
          </div>
          <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] font-medium text-bone mt-4">
            Before you borrow
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-sage">
            Straight answers from the protocol — no sales copy, no deflection.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
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
  );
}
