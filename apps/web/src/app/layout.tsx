import type { Metadata } from 'next';
import { Inter, Permanent_Marker, Creepster } from 'next/font/google';
import './globals.css';

import { ConditionalNavbar } from '@/components/conditional-navbar';
import { WalletProvider } from "@/components/wallet-provider"

const inter = Inter({ subsets: ['latin'] });
const permanentMarker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' });
const creepster = Creepster({ weight: '400', subsets: ['latin'], variable: '--font-creepster' });

export const metadata: Metadata = {
  metadataBase: new URL('https://boateatsboat.vercel.app'),
  title: 'BoatEatsBoat',
  description: 'On-chain battleship in a bathtub. Plastic ships, rubber ducks, real Celo duels.',
  openGraph: {
    title: 'BoatEatsBoat',
    description: 'On-chain battleship in a bathtub. Plastic ships, rubber ducks, real Celo duels.',
    type: 'website',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${permanentMarker.variable} ${creepster.variable}`}>
        {/* Navbar is included on all pages */}
        <div className="relative flex min-h-screen flex-col">
          <WalletProvider>
            <ConditionalNavbar />
            <main className="flex-1">
              {children}
            </main>
          </WalletProvider>
        </div>
      </body>
    </html>
  );
}
