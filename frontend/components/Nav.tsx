'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import WalletButton from '@/components/wallet/WalletButton';

const links = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/explorer', label: 'Explorer' },
  { href: '/faq', label: 'FAQ' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 border-b ${
        scrolled || menuOpen
          ? 'bg-ink/90 backdrop-blur-xl border-line'
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Home">
          <span className="relative w-9 h-9 rounded-full border border-verdigris/60 flex items-center justify-center shrink-0">
            <span className="absolute inset-[3px] rounded-full border border-seal/30" />
            <span className="font-display text-sm font-semibold text-bone leading-none">V</span>
          </span>
          <span className="hidden sm:block leading-none">
            <span className="block font-display text-[15px] tracking-wide text-bone">
              Vouch
            </span>
            <span className="block font-mono text-[9px] tracking-[0.3em] uppercase text-sage mt-1.5">
              Borrow on reputation
            </span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`px-4 py-2 text-[13px] font-medium border-b transition-colors ${
                  active
                    ? 'text-verdigris border-verdigris'
                    : 'text-sage border-transparent hover:text-bone'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 text-[13px] font-medium text-sage hover:text-bone transition-colors"
          >
            Open App
          </Link>
          <WalletButton />
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-sage hover:text-bone transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeWidth={1.5} d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-line bg-ink/95 backdrop-blur-xl px-6 py-4 space-y-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`block px-3 py-2.5 text-sm rounded-md ${
                  active ? 'text-verdigris bg-verdigris/10' : 'text-sage hover:text-bone hover:bg-bone/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            className="block mt-3 text-center px-5 py-3 text-sm font-medium text-sage hover:text-bone transition-colors"
          >
            Open App
          </Link>
          <div className="mt-2">
            <WalletButton compact />
          </div>
        </div>
      )}
    </nav>
  );
}
