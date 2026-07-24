import type { Metadata, Viewport } from 'next';
import { Inter, Permanent_Marker, Creepster } from 'next/font/google';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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
  other: {
    'talentapp:project_verification':
      '89afb80bf7567bd65c97921cf8fe21bedfd1ec32ff45b333d7a018786ace55307afc4eb310bb493479a1fdc5b57dd7fa9eb603cdba79f5128853e880d37c407f',
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
        <div className="relative flex h-[100dvh] flex-col overflow-hidden">
          <WalletProvider>
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </WalletProvider>
        </div>
        {/* Rotate-to-landscape prompt (mobile portrait only). See .rotate-overlay in globals.css */}
        <div className="rotate-overlay" aria-hidden="true">
          <div className="rotate-overlay__inner">
            <div className="rotate-overlay__icon">🔄</div>
            <p className="rotate-overlay__text">Rotate your device</p>
            <p className="rotate-overlay__sub">BoatEatsBoat plays in landscape</p>
          </div>
        </div>
      </body>
    </html>
  );
}
