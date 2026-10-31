import Link from 'next/link';

const columns = [
  {
    title: 'Protocol',
    items: [
      { label: 'Features', href: '/features' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Transaction Explorer', href: '/explorer' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'GenLayer Docs', href: 'https://docs.genlayer.com', external: true },
      { label: 'GenLayer Studio', href: 'https://studio.genlayer.com', external: true },
      { label: 'GitHub', href: 'https://github.com/genlayer', external: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative w-9 h-9 rounded-full border border-verdigris/60 flex items-center justify-center">
                <span className="absolute inset-[3px] rounded-full border border-seal/30" />
                <span className="font-display text-sm font-semibold text-bone leading-none">V</span>
              </span>
              <span className="font-display text-[15px] tracking-wide text-bone">Vouch</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-sage max-w-sm">
              Real-world identity, scored by validator consensus. Under-collateralized
              lending on the GenLayer intelligence layer — borrow on a vouch, not on a
              lockup.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase text-verdigris mb-4">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.items.map((item) =>
                  'external' in item && item.external ? (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-sage hover:text-bone transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  ) : (
                    <li key={item.label}>
                      <Link href={item.href} className="text-sm text-sage hover:text-bone transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="rule-engraved mt-12 mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-sage/70">
          <p>&copy; 2026 Vouch. All rights reserved.</p>
          <p className="break-all">
            runner: py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6
          </p>
        </div>
      </div>
    </footer>
  );
}
