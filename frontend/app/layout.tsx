import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import WalletModal from '@/components/wallet/WalletModal';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vouch — Under-Collateralized Lending on GenLayer',
  description:
    'Vouch connects real-world identity to on-chain reputation. Borrow with less collateral through GenLayer consensus-driven smart contracts.',
  keywords: ['DeFi', 'under-collateralized lending', 'GenLayer', 'on-chain reputation', 'smart contracts', 'decentralized finance', 'Vouch'],
  authors: [{ name: 'Vouch Protocol' }],
  openGraph: {
    title: 'Vouch — Under-Collateralized Lending on GenLayer',
    description: 'Connect real-world identity to on-chain reputation. Borrow on a vouch, not on a lockup.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vouch — Under-Collateralized Lending on GenLayer',
    description: 'Connect real-world identity to on-chain reputation. Borrow on a vouch, not on a lockup.',
  },
  robots: 'index, follow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-ink text-bone selection:bg-verdigris/30">
        <WalletProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
          <WalletModal />
        </WalletProvider>
      </body>
    </html>
  );
}
